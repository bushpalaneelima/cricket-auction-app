'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Manager {
  manager_id: number;
  manager_name: string;
  starting_budget: number;
  current_budget: number;
}

interface TeamData {
  manager_id: number;
  manager_name: string;
  total_spent: number;
  budget_remaining: number;
  player_count: number;
  avg_price: number;
  most_expensive: number;
}

interface Player {
  player_id: number;
  player_name: string;
  price: number;
  manager_name: string;
  role: string;
  class_band: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Manager | null>(null);
  const [auctionId, setAuctionId] = useState<number | null>(null);
  const [teamsData, setTeamsData] = useState<TeamData[]>([]);
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);
  const [totalPlayersSold, setTotalPlayersSold] = useState(0);
  const [totalMoneySpent, setTotalMoneySpent] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    const { data: mgr } = await supabase
      .from('managers')
      .select('*')
      .eq('email', session.user.email)
      .single();

    if (!mgr) {
      router.push('/login');
      return;
    }

    setCurrentUser(mgr);
    await loadReports();
    setLoading(false);
  };

  const loadReports = async () => {
    // Get most recent auction
    const { data: auction } = await supabase
      .from('auctions')
      .select('auction_id')
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .single();

    if (!auction) {
      console.log('No auction found');
      return;
    }

    setAuctionId(auction.auction_id);

    // Get all managers with budgets
    const { data: managers } = await supabase
      .from('managers')
      .select('*')
      .gt('starting_budget', 0)
      .order('manager_name');

    if (!managers) return;

    // Get all team players for this auction
    const { data: allTeamPlayers } = await supabase
      .from('team_players')
      .select('manager_id, player_id, price')
      .eq('auction_id', auction.auction_id);

    if (!allTeamPlayers) return;

    // Calculate team statistics
    const teamsStats: TeamData[] = managers.map(mgr => {
      const teamPlayers = allTeamPlayers.filter(tp => tp.manager_id === mgr.manager_id);
      const totalSpent = teamPlayers.reduce((sum, tp) => sum + tp.price, 0);
      const playerCount = teamPlayers.length;
      const avgPrice = playerCount > 0 ? Math.round(totalSpent / playerCount) : 0;
      const mostExpensive = playerCount > 0 
        ? Math.max(...teamPlayers.map(tp => tp.price))
        : 0;

      return {
        manager_id: mgr.manager_id,
        manager_name: mgr.manager_name,
        total_spent: totalSpent,
        budget_remaining: mgr.current_budget,
        player_count: playerCount,
        avg_price: avgPrice,
        most_expensive: mostExpensive,
      };
    });

    // Sort by total spent (descending)
    teamsStats.sort((a, b) => b.total_spent - a.total_spent);
    setTeamsData(teamsStats);

    // Calculate totals
    setTotalPlayersSold(allTeamPlayers.length);
    setTotalMoneySpent(allTeamPlayers.reduce((sum, tp) => sum + tp.price, 0));

    // Get top 10 most expensive players
    const playerIds = allTeamPlayers.map(tp => tp.player_id);
    
    if (playerIds.length > 0) {
      const { data: playersData } = await supabase
        .from('players')
        .select('player_id, player_name, role, class_band')
        .in('player_id', playerIds);

      if (playersData) {
        const playersWithPrices = allTeamPlayers.map(tp => {
          const player = playersData.find(p => p.player_id === tp.player_id);
          const manager = managers.find(m => m.manager_id === tp.manager_id);
          
          return {
            player_id: tp.player_id,
            player_name: player?.player_name || 'Unknown',
            price: tp.price,
            manager_name: manager?.manager_name || 'Unknown',
            role: player?.role || '',
            class_band: player?.class_band || '',
          };
        });

        // Sort by price and get top 10
        playersWithPrices.sort((a, b) => b.price - a.price);
        setTopPlayers(playersWithPrices.slice(0, 10));
      }
    }
  };

  const downloadCSV = () => {
    if (!teamsData.length) return;

    // Create CSV content
    const headers = ['Team', 'Players', 'Total Spent', 'Budget Remaining', 'Avg Price', 'Most Expensive'];
    const rows = teamsData.map(team => [
      team.manager_name,
      team.player_count,
      team.total_spent,
      team.budget_remaining,
      team.avg_price,
      team.most_expensive,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auction-${auctionId}-summary.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadDetailedCSV = async () => {
    if (!auctionId) {
      alert('No auction data available!');
      return;
    }

    // Get all team players with full details
    const { data: teamPlayers } = await supabase
      .from('team_players')
      .select(`
        player_id,
        price,
        round,
        manager_id,
        managers (manager_name)
      `)
      .eq('auction_id', auctionId)
      .order('manager_id');

    if (!teamPlayers || teamPlayers.length === 0) {
      alert('No player data to download!');
      return;
    }

    // Get all player details
    const playerIds = teamPlayers.map((tp: any) => tp.player_id);
    const { data: playersData } = await supabase
      .from('players')
      .select('player_id, player_name, role, class_band, country')
      .in('player_id', playerIds);

    const playerMap = new Map(playersData?.map(p => [p.player_id, p]) || []);

    // Create detailed CSV
    const headers = ['Manager Name', 'Player Name', 'Role', 'Class', 'Country', 'Purchase Price', 'Round'];
    const rows = teamPlayers.map((tp: any) => {
      const player = playerMap.get(tp.player_id);
      const manager = tp.managers;
      
      if (!player || !manager) return null;
      
      return [
        `"${manager.manager_name}"`,
        `"${player.player_name}"`,
        `"${player.role}"`,
        `"${player.class_band}"`,
        `"${player.country || '-'}"`,
        tp.price,
        tp.round || 1
      ].join(',');
    }).filter((row: any) => row !== null);

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auction-${auctionId}-players-detailed.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#F8F8FC'
      }}>
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F8FC',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          background: 'white',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '20px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <h1 style={{ fontSize: '28px', color: '#02084b', marginBottom: '5px' }}>
                📈 Auction Reports
              </h1>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Comprehensive auction statistics and team comparison
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={downloadCSV}
                style={{
                  padding: '10px 20px',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                📥 Download Summary
              </button>
              <button
                onClick={downloadDetailedCSV}
                style={{
                  padding: '10px 20px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                📋 Download Player Details
              </button>
              <button
                onClick={() => router.push('/home')}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#02084b',
                  border: '2px solid #02084b',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                ← Back to Home
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '15px',
          marginBottom: '20px',
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Total Players Sold</p>
            <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#02084b', margin: 0 }}>
              {totalPlayersSold}
            </p>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Total Money Spent</p>
            <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#d32f2f', margin: 0 }}>
              {totalMoneySpent}
            </p>
            <p style={{ color: '#999', fontSize: '11px', marginTop: '3px' }}>points</p>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Average Per Player</p>
            <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#02084b', margin: 0 }}>
              {totalPlayersSold > 0 ? Math.round(totalMoneySpent / totalPlayersSold) : 0}
            </p>
            <p style={{ color: '#999', fontSize: '11px', marginTop: '3px' }}>points</p>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Active Teams</p>
            <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#02084b', margin: 0 }}>
              {teamsData.length}
            </p>
          </div>
        </div>

        {/* Teams Leaderboard */}
        <div style={{
          background: 'white',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '20px',
        }}>
          <h2 style={{ fontSize: '20px', color: '#02084b', marginBottom: '15px' }}>
            🏆 Teams Leaderboard
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#666', fontSize: '12px', fontWeight: '600' }}>Rank</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#666', fontSize: '12px', fontWeight: '600' }}>Team</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#666', fontSize: '12px', fontWeight: '600' }}>Players</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: '#666', fontSize: '12px', fontWeight: '600' }}>Total Spent</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: '#666', fontSize: '12px', fontWeight: '600' }}>Remaining</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: '#666', fontSize: '12px', fontWeight: '600' }}>Avg Price</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: '#666', fontSize: '12px', fontWeight: '600' }}>Most Expensive</th>
                </tr>
              </thead>
              <tbody>
                {teamsData.map((team, index) => (
                  <tr
                    key={team.manager_id}
                    style={{
                      borderBottom: '1px solid #eee',
                      background: team.manager_id === currentUser?.manager_id ? '#e3f2fd' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '15px', fontSize: '14px', color: '#02084b', fontWeight: 'bold' }}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                    </td>
                    <td style={{ padding: '15px', fontSize: '14px', color: '#02084b', fontWeight: 'bold' }}>
                      {team.manager_name}
                      {team.manager_id === currentUser?.manager_id && (
                        <span style={{ color: '#666', fontSize: '11px', marginLeft: '5px' }}>(You)</span>
                      )}
                    </td>
                    <td style={{ padding: '15px', fontSize: '14px', color: '#02084b', textAlign: 'center' }}>
                      {team.player_count}
                    </td>
                    <td style={{ padding: '15px', fontSize: '14px', color: '#d32f2f', fontWeight: 'bold', textAlign: 'right' }}>
                      {team.total_spent}
                    </td>
                    <td style={{ padding: '15px', fontSize: '14px', color: '#2e7d32', textAlign: 'right' }}>
                      {team.budget_remaining}
                    </td>
                    <td style={{ padding: '15px', fontSize: '14px', color: '#02084b', textAlign: 'right' }}>
                      {team.avg_price}
                    </td>
                    <td style={{ padding: '15px', fontSize: '14px', color: '#ff9800', fontWeight: 'bold', textAlign: 'right' }}>
                      {team.most_expensive}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 Most Expensive Players */}
        <div style={{
          background: 'white',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: '20px', color: '#02084b', marginBottom: '15px' }}>
            💎 Top 10 Most Expensive Players
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '12px',
          }}>
            {topPlayers.map((player, index) => (
              <div
                key={player.player_id}
                style={{
                  padding: '15px',
                  background: index < 3 ? '#fff3e0' : '#f8f9fa',
                  borderRadius: '8px',
                  border: index < 3 ? '2px solid #ff9800' : '1px solid #ddd',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  marginBottom: '8px',
                }}>
                  <div>
                    <div style={{ fontSize: '18px', marginBottom: '3px' }}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                    </div>
                    <h4 style={{ fontSize: '15px', color: '#02084b', margin: 0, fontWeight: 'bold' }}>
                      {player.player_name}
                    </h4>
                  </div>
                  <div style={{
                    padding: '5px 10px',
                    background: '#d32f2f',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}>
                    {player.price} pts
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  <p style={{ margin: '3px 0' }}>
                    <strong>Team:</strong> {player.manager_name}
                  </p>
                  <p style={{ margin: '3px 0' }}>
                    <strong>Role:</strong> {player.role}
                  </p>
                  <p style={{ margin: '3px 0' }}>
                    <strong>Class:</strong> {player.class_band}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          paddingTop: '20px',
          color: '#999',
          fontSize: '12px',
        }}>
          Powered by <strong style={{ color: '#02084b' }}>NB Blue Studios</strong>
        </div>
      </div>
    </div>
  );
}
