'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Manager {
  manager_id: number;
  manager_name: string;
  email: string;
  role: string;
  current_budget: number;
}

interface Player {
  player_id: number;
  player_name: string;
  country: string;
  role: string;
  class_band: string;
}

interface Selection {
  manager_id: number;
  manager_name: string;
  player_count: number;
  players: Player[];
}

export default function AdminRound2Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Manager | null>(null);
  const [auctionId, setAuctionId] = useState<number | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [unsoldPlayers, setUnsoldPlayers] = useState<Player[]>([]);
  const [totalSelected, setTotalSelected] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!auctionId) return;

    const channel = supabase
      .channel('admin-round2-selections')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'round2_selections',
      }, () => {
        loadSelections();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auctionId]);

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

    if (!mgr || mgr.role !== 'admin') {
      alert('Admin access only!');
      router.push('/home');
      return;
    }

    setCurrentUser(mgr);
    await loadRound2Data();
    setLoading(false);
  };

  const loadRound2Data = async () => {
    const { data: auction } = await supabase
      .from('auctions')
      .select('*')
      .eq('status', 'completed')
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .single();

    if (!auction) {
      alert('No completed auction found!');
      router.push('/home');
      return;
    }

    setAuctionId(auction.auction_id);

    // Load unsold players
    const { data: unsold } = await supabase
      .from('unsold_players')
      .select('player_id')
      .eq('auction_id', auction.auction_id);

    if (unsold && unsold.length > 0) {
      const unsoldIds = unsold.map(u => u.player_id);
      const { data: players } = await supabase
        .from('players')
        .select('*')
        .in('player_id', unsoldIds);

      setUnsoldPlayers(players || []);
    }

    await loadSelections();
  };

  const loadSelections = async () => {
    if (!auctionId) return;

    // Get all managers
    const { data: managers } = await supabase
      .from('managers')
      .select('*')
      .gt('starting_budget', 0)
      .order('manager_name');

    if (!managers) return;

    // Get all selections
    const { data: allSelections } = await supabase
      .from('round2_selections')
      .select('manager_id, player_id')
      .eq('auction_id', auctionId);

    const selectionMap = new Map<number, number[]>();
    (allSelections || []).forEach(s => {
      const existing = selectionMap.get(s.manager_id) || [];
      selectionMap.set(s.manager_id, [...existing, s.player_id]);
    });

    // Get player details for all selected players
    const allPlayerIds = Array.from(selectionMap.values()).flat();
    const { data: players } = await supabase
      .from('players')
      .select('*')
      .in('player_id', allPlayerIds);

    const playerMap = new Map(players?.map(p => [p.player_id, p]) || []);

    // Build selections data
    const selectionsData: Selection[] = managers.map(mgr => {
      const playerIds = selectionMap.get(mgr.manager_id) || [];
      const playerDetails = playerIds
        .map(id => playerMap.get(id))
        .filter(p => p !== undefined) as Player[];

      return {
        manager_id: mgr.manager_id,
        manager_name: mgr.manager_name,
        player_count: playerDetails.length,
        players: playerDetails,
      };
    });

    setSelections(selectionsData);
    setTotalSelected(allPlayerIds.length);
  };

  const handleOpenSelection = async () => {
    if (!auctionId) return;

    const confirmed = confirm(
      '🎯 Open Round 2 Selection?\n\n' +
      'Managers will be able to select 5 players each from unsold list.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    await supabase
      .from('auctions')
      .update({ round2_selection_open: true })
      .eq('auction_id', auctionId);

    alert('✅ Round 2 selection is now OPEN!\n\nManagers can now select players at /round2/select');
  };

  const handleCloseSelection = async () => {
    if (!auctionId) return;

    await supabase
      .from('auctions')
      .update({ round2_selection_open: false })
      .eq('auction_id', auctionId);

    alert('✅ Round 2 selection is now CLOSED!');
  };

  const handleStartRound2 = async () => {
    if (!auctionId) return;

    if (totalSelected === 0) {
      alert('⚠️ No players selected yet! Cannot start Round 2.');
      return;
    }

    const confirmed = confirm(
      `🚀 Start Round 2 Auction?\n\n` +
      `Total players selected: ${totalSelected}\n` +
      `These players will be auctioned in RANDOM order at 0 pts base price.\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    try {
      // Close selection
      await supabase
        .from('auctions')
        .update({
          round2_selection_open: false,
          round2_started: true,
          status: 'round2',
        })
        .eq('auction_id', auctionId);

      alert('✅ Round 2 auction started!\n\nRedirecting to auction page...');
      router.push('/auction');
    } catch (error) {
      console.error('Error starting Round 2:', error);
      alert('Error starting Round 2. Please try again.');
    }
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
        <p>Loading...</p>
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
                🎯 Round 2 Admin Control
              </h1>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Manage player selections and start Round 2 auction
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

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
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
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Total Unsold Players</p>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#02084b', margin: 0 }}>
              {unsoldPlayers.length}
            </p>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Players Selected</p>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#28a745', margin: 0 }}>
              {totalSelected}
            </p>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Managers</p>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#02084b', margin: 0 }}>
              {selections.length}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          <h2 style={{ fontSize: '18px', color: '#02084b', marginBottom: '15px' }}>
            Admin Actions
          </h2>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={handleOpenSelection}
              style={{
                padding: '12px 30px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              🔓 Open Selection
            </button>
            <button
              onClick={handleCloseSelection}
              style={{
                padding: '12px 30px',
                background: '#ffc107',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              🔒 Close Selection
            </button>
            <button
              onClick={handleStartRound2}
              disabled={totalSelected === 0}
              style={{
                padding: '12px 30px',
                background: totalSelected === 0 ? '#ccc' : '#02084b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: totalSelected === 0 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              🚀 Start Round 2 Auction
            </button>
          </div>
        </div>

        {/* Manager Selections */}
        <div style={{
          background: 'white',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        }}>
          <h2 style={{ fontSize: '20px', color: '#02084b', marginBottom: '20px' }}>
            Manager Selections
          </h2>

          <div style={{ display: 'grid', gap: '15px' }}>
            {selections.map(selection => (
              <div
                key={selection.manager_id}
                style={{
                  padding: '15px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: selection.player_count === 5 
                    ? '2px solid #28a745' 
                    : selection.player_count === 0
                    ? '2px solid #dc3545'
                    : '2px solid #ffc107',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}>
                  <h3 style={{ fontSize: '16px', color: '#02084b', margin: 0 }}>
                    {selection.manager_name}
                  </h3>
                  <span style={{
                    padding: '4px 12px',
                    background: selection.player_count === 5 
                      ? '#28a745' 
                      : selection.player_count === 0
                      ? '#dc3545'
                      : '#ffc107',
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}>
                    {selection.player_count} / 5 selected
                  </span>
                </div>

                {selection.players.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '8px',
                  }}>
                    {selection.players.map(player => (
                      <div
                        key={player.player_id}
                        style={{
                          padding: '8px',
                          background: 'white',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      >
                        <p style={{ fontWeight: 'bold', color: '#02084b', margin: '0 0 3px 0' }}>
                          {player.player_name}
                        </p>
                        <p style={{ color: '#666', margin: 0 }}>
                          {player.role} • {player.class_band}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#999', fontSize: '14px', margin: 0, fontStyle: 'italic' }}>
                    No players selected yet
                  </p>
                )}
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