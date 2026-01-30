'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Manager {
  manager_id: number;
  manager_name: string;
  team_name?: string;
  email: string;
  starting_budget: number;
  current_budget: number;
}

interface Player {
  player_id: number;
  player_name: string;
  country: string;
  role: string;
  class_band: string;
  price: number;
  round?: number;
}

interface RoleCounts {
  Batsman: number;
  Bowler: number;
  'All-rounder': number;
  'Wicket Keeper': number;
}

export default function MyTeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Manager | null>(null);
  const [myTeam, setMyTeam] = useState<Player[]>([]);
  const [auctionId, setAuctionId] = useState<number | null>(null);

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
    await loadMyTeam(mgr.manager_id);
    setLoading(false);
  };

  const loadMyTeam = async (managerId: number) => {
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

    // Get team players
    const { data: teamData } = await supabase
      .from('team_players')
      .select('player_id, price, round')
      .eq('manager_id', managerId)
      .eq('auction_id', auction.auction_id);

    if (!teamData || teamData.length === 0) {
      setMyTeam([]);
      return;
    }

    const playerIds = teamData.map(item => item.player_id);

    // Get player details
    const { data: playersData } = await supabase
      .from('players')
      .select('*')
      .in('player_id', playerIds);

    if (playersData) {
      const teamWithPrices = playersData.map(player => {
        const teamPlayer = teamData.find(tp => tp.player_id === player.player_id);
        return {
          ...player,
          price: teamPlayer?.price || 0,
          round: teamPlayer?.round || 1,
        };
      });
      setMyTeam(teamWithPrices);
    }
  };

  const getRoleCounts = (): RoleCounts => {
    const counts: RoleCounts = {
      'Batsman': 0,
      'Bowler': 0,
      'All-rounder': 0,
      'Wicket Keeper': 0,
    };

    myTeam.forEach(player => {
      if (player.role in counts) {
        counts[player.role as keyof RoleCounts]++;
      }
    });

    return counts;
  };

  const getRequirementStatus = (current: number, minimum: number) => {
    if (current >= minimum) return { icon: '✅', color: '#2e7d32', status: 'Complete' };
    if (current > 0) return { icon: '⚠️', color: '#f57c00', status: 'In Progress' };
    return { icon: '❌', color: '#d32f2f', status: 'Required' };
  };

  const getTotalSpent = () => {
    return myTeam.reduce((sum, player) => sum + player.price, 0);
  };

  const groupPlayersByRole = () => {
    const grouped: { [key: string]: Player[] } = {
      'Batsman': [],
      'Bowler': [],
      'All-rounder': [],
      'Wicket Keeper': [],
    };

    myTeam.forEach(player => {
      if (player.role in grouped) {
        grouped[player.role].push(player);
      }
    });

    return grouped;
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
        <p>Loading your team...</p>
      </div>
    );
  }

  const roleCounts = getRoleCounts();
  const totalSpent = getTotalSpent();
  const groupedPlayers = groupPlayersByRole();

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
                📊 {currentUser?.team_name || currentUser?.manager_name}'s Team
              </h1>
              <p style={{ color: '#666', fontSize: '14px' }}>
                View your squad and budget breakdown
              </p>
            </div>
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

        {/* Budget & Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Budget Spent</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#d32f2f', margin: 0 }}>
              {totalSpent}
            </p>
            <p style={{ color: '#999', fontSize: '11px', marginTop: '3px' }}>
              out of {currentUser?.starting_budget}
            </p>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Budget Remaining</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#2e7d32', margin: 0 }}>
              {currentUser?.current_budget}
            </p>
            <p style={{ color: '#999', fontSize: '11px', marginTop: '3px' }}>
              points left
            </p>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Squad Size</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#02084b', margin: 0 }}>
              {myTeam.length} / 15
            </p>
            <p style={{ color: '#999', fontSize: '11px', marginTop: '3px' }}>
              {myTeam.length >= 11 ? 'minimum met ✅' : `need ${11 - myTeam.length} more`}
            </p>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Average Price</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#02084b', margin: 0 }}>
              {myTeam.length > 0 ? Math.round(totalSpent / myTeam.length) : 0}
            </p>
            <p style={{ color: '#999', fontSize: '11px', marginTop: '3px' }}>
              points per player
            </p>
          </div>
        </div>

        {/* Role Requirements */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '20px',
        }}>
          <h2 style={{ fontSize: '20px', color: '#02084b', marginBottom: '15px' }}>
            📋 Team Requirements
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '15px',
          }}>
            {[
              { role: 'Batsman', min: 3 },
              { role: 'Bowler', min: 3 },
              { role: 'All-rounder', min: 2 },
              { role: 'Wicket Keeper', min: 1 },
            ].map(req => {
              const count = roleCounts[req.role as keyof RoleCounts];
              const status = getRequirementStatus(count, req.min);
              return (
                <div
                  key={req.role}
                  style={{
                    padding: '15px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    border: `2px solid ${status.color}`,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <p style={{ fontSize: '14px', color: '#02084b', fontWeight: 'bold', margin: 0 }}>
                        {req.role}s
                      </p>
                      <p style={{ fontSize: '11px', color: '#666', margin: '3px 0 0 0' }}>
                        Minimum: {req.min}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '24px', margin: 0 }}>{status.icon}</p>
                      <p style={{ fontSize: '18px', fontWeight: 'bold', color: status.color, margin: 0 }}>
                        {count} / {req.min}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Players by Role */}
        {myTeam.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '48px', margin: '0 0 15px 0' }}>🏏</p>
            <h2 style={{ fontSize: '24px', color: '#02084b', marginBottom: '10px' }}>
              No Players Yet
            </h2>
            <p style={{ color: '#666', fontSize: '14px' }}>
              Start bidding in the auction to build your team!
            </p>
          </div>
        ) : (
          Object.entries(groupedPlayers).map(([role, players]) => {
            if (players.length === 0) return null;
            
            return (
              <div
                key={role}
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  marginBottom: '20px',
                }}
              >
                <h3 style={{ fontSize: '18px', color: '#02084b', marginBottom: '15px' }}>
                  {role}s ({players.length})
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '12px',
                }}>
                  {players.map(player => (
                    <div
                      key={player.player_id}
                      style={{
                        padding: '15px',
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        border: '1px solid #ddd',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        marginBottom: '8px',
                      }}>
                        <h4 style={{ fontSize: '15px', color: '#02084b', margin: 0, fontWeight: 'bold' }}>
                          {player.player_name}
                        </h4>
                        <span style={{
                          padding: '3px 8px',
                          background: player.round === 2 ? '#ff9800' : '#02084b',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                        }}>
                          R{player.round || 1}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        <p style={{ margin: '3px 0' }}>
                          <strong>Country:</strong> {player.country}
                        </p>
                        <p style={{ margin: '3px 0' }}>
                          <strong>Class:</strong> {player.class_band}
                        </p>
                        <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                          <strong style={{ color: '#d32f2f' }}>Price: {player.price} pts</strong>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}

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
