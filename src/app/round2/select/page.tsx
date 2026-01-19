'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Player {
  player_id: number;
  player_name: string;
  country: string;
  role: string;
  class_band: string;
  base_price: number;
}

interface Selection {
  selection_id: number;
  player_id: number;
  manager_id: number;
  manager_name?: string;
}

interface Manager {
  manager_id: number;
  manager_name: string;
  email: string;
  role: string;
}

export default function Round2SelectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Manager | null>(null);
  const [unsoldPlayers, setUnsoldPlayers] = useState<Player[]>([]);
  const [mySelections, setMySelections] = useState<number[]>([]);
  const [allSelections, setAllSelections] = useState<Selection[]>([]);
  const [auctionId, setAuctionId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  // Real-time subscription to selections
  useEffect(() => {
    if (!auctionId) return;

    const channel = supabase
      .channel('round2-selections')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'round2_selections',
        filter: `auction_id=eq.${auctionId}`,
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

    if (!mgr) {
      router.push('/login');
      return;
    }

    setCurrentUser(mgr);
    await loadRound2Data(mgr.manager_id);
    setLoading(false);
  };

  const loadRound2Data = async (managerId: number) => {
    // Get current auction
    const { data: auction } = await supabase
      .from('auctions')
      .select('*')
      .eq('status', 'completed')
      .eq('round2_selection_open', true)
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .single();

    if (!auction) {
      alert('Round 2 selection is not open yet!');
      router.push('/home');
      return;
    }

    setAuctionId(auction.auction_id);

    // Load unsold players from Round 1
    const { data: unsold } = await supabase
      .from('unsold_players')
      .select('player_id')
      .eq('auction_id', auction.auction_id);

    if (!unsold || unsold.length === 0) {
      alert('No unsold players available!');
      router.push('/home');
      return;
    }

    const unsoldIds = unsold.map(u => u.player_id);

    // Get player details
    const { data: players } = await supabase
      .from('players')
      .select('*')
      .in('player_id', unsoldIds)
      .order('player_name');

    setUnsoldPlayers(players || []);

    // Load selections
    await loadSelections();
  };

  const loadSelections = async () => {
    if (!auctionId || !currentUser) return;

    // Get all selections with manager names
    const { data: selections } = await supabase
      .from('round2_selections')
      .select(`
        selection_id,
        player_id,
        manager_id,
        managers (manager_name)
      `)
      .eq('auction_id', auctionId);

    const selectionsWithNames = (selections || []).map(s => ({
      selection_id: s.selection_id,
      player_id: s.player_id,
      manager_id: s.manager_id,
      manager_name: (s.managers as any)?.manager_name || 'Unknown',
    }));

    setAllSelections(selectionsWithNames);

    // Get my selections
    const mySelectIds = selectionsWithNames
      .filter(s => s.manager_id === currentUser.manager_id)
      .map(s => s.player_id);

    setMySelections(mySelectIds);
  };

  const handleSelectPlayer = async (playerId: number) => {
    if (!currentUser || !auctionId) return;

    // Check if already selected by someone else
    const existingSelection = allSelections.find(s => s.player_id === playerId);
    if (existingSelection && existingSelection.manager_id !== currentUser.manager_id) {
      alert(`Already selected by ${existingSelection.manager_name}! Choose a different player.`);
      return;
    }

    // Check if manager already has 5 selections
    if (mySelections.length >= 5 && !mySelections.includes(playerId)) {
      alert('You can only select maximum 5 players!');
      return;
    }

    // Toggle selection
    if (mySelections.includes(playerId)) {
      // Deselect
      await supabase
        .from('round2_selections')
        .delete()
        .eq('auction_id', auctionId)
        .eq('manager_id', currentUser.manager_id)
        .eq('player_id', playerId);

      console.log('✅ Player deselected');
    } else {
      // Select
      const { error } = await supabase
        .from('round2_selections')
        .insert({
          auction_id: auctionId,
          manager_id: currentUser.manager_id,
          player_id: playerId,
        });

      if (error) {
        if (error.code === '23505') {
          alert('This player was just selected by another manager! Choose a different player.');
        } else {
          console.error('Error selecting player:', error);
          alert('Error selecting player. Please try again.');
        }
        return;
      }

      console.log('✅ Player selected');
    }

    await loadSelections();
  };

  const filteredPlayers = unsoldPlayers.filter(player =>
    player.player_name.toLowerCase().includes(searchText.toLowerCase()) ||
    player.country.toLowerCase().includes(searchText.toLowerCase())
  );

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
      background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(2, 8, 75, 0.2)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '15px',
          borderBottom: '2px solid #eee',
        }}>
          <div>
            <h1 style={{ fontSize: '28px', color: '#02084b', marginBottom: '5px' }}>
              🎯 Round 2 - Player Selection
            </h1>
            <p style={{ color: '#666', fontSize: '14px' }}>
              Select <strong>5 players</strong> for Round 2 auction (Base price: 0 pts)
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

        {/* Selection Counter */}
        <div style={{
          background: mySelections.length === 5 ? '#d4edda' : '#fff3cd',
          border: `2px solid ${mySelections.length === 5 ? '#c3e6cb' : '#ffc107'}`,
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          <h2 style={{
            color: mySelections.length === 5 ? '#155724' : '#856404',
            fontSize: '20px',
            margin: 0,
          }}>
            Your Selections: {mySelections.length} / 5
          </h2>
          {mySelections.length === 5 && (
            <p style={{ color: '#155724', fontSize: '12px', margin: '5px 0 0 0' }}>
              ✅ Complete! You can still change your selections.
            </p>
          )}
        </div>

        {/* Search */}
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="🔍 Search players by name or country..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              border: '2px solid #ddd',
              borderRadius: '6px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Players Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '15px',
          maxHeight: '500px',
          overflowY: 'auto',
        }}>
          {filteredPlayers.map(player => {
            const isMySelection = mySelections.includes(player.player_id);
            const otherSelection = allSelections.find(
              s => s.player_id === player.player_id && s.manager_id !== currentUser?.manager_id
            );

            return (
              <div
                key={player.player_id}
                onClick={() => {
                  if (!otherSelection) {
                    handleSelectPlayer(player.player_id);
                  }
                }}
                style={{
                  padding: '15px',
                  background: isMySelection 
                    ? '#d4edda' 
                    : otherSelection 
                    ? '#f8d7da' 
                    : '#f8f9fa',
                  border: isMySelection
                    ? '2px solid #28a745'
                    : otherSelection
                    ? '2px solid #dc3545'
                    : '1px solid #ddd',
                  borderRadius: '8px',
                  cursor: otherSelection ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: otherSelection ? 0.6 : 1,
                }}
              >
                {/* Player Name */}
                <h3 style={{
                  fontSize: '16px',
                  color: '#02084b',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  {player.player_name}
                  {isMySelection && <span style={{ fontSize: '20px' }}>✅</span>}
                  {otherSelection && <span style={{ fontSize: '20px' }}>🔒</span>}
                </h3>

                {/* Player Details */}
                <div style={{ fontSize: '12px', color: '#666' }}>
                  <p style={{ margin: '3px 0' }}>
                    <strong>Country:</strong> {player.country}
                  </p>
                  <p style={{ margin: '3px 0' }}>
                    <strong>Role:</strong> {player.role}
                  </p>
                  <p style={{ margin: '3px 0' }}>
                    <strong>Class:</strong> {player.class_band}
                  </p>
                  <p style={{ margin: '3px 0' }}>
                    <strong>Round 2 Price:</strong> 0 pts (FREE)
                  </p>
                </div>

                {/* Status */}
                {otherSelection && (
                  <div style={{
                    marginTop: '10px',
                    padding: '8px',
                    background: '#dc3545',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '11px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}>
                    Selected by {otherSelection.manager_name}
                  </div>
                )}

                {isMySelection && (
                  <div style={{
                    marginTop: '10px',
                    padding: '8px',
                    background: '#28a745',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '11px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}>
                    Click to deselect
                  </div>
                )}

                {!isMySelection && !otherSelection && (
                  <div style={{
                    marginTop: '10px',
                    padding: '8px',
                    background: '#02084b',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '11px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}>
                    Click to select
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredPlayers.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666',
          }}>
            <p style={{ fontSize: '16px' }}>No players found matching "{searchText}"</p>
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          paddingTop: '20px',
          marginTop: '20px',
          borderTop: '1px solid #eee',
          color: '#999',
          fontSize: '12px',
        }}>
          Powered by <strong style={{ color: '#02084b' }}>NB Blue Studios</strong>
        </div>
      </div>
    </div>
  );
}