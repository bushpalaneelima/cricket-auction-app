'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Participant {
  participant_id: number;
  starting_budget: number;
  current_budget: number;
  is_ready: boolean;
  managers: {
    manager_id: number;
    manager_name: string;
    email: string;
    role: string;
  };
}

export default function LobbyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeAuction, setActiveAuction] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    checkActiveAuction();
  }, []);

  useEffect(() => {
    if (activeAuction) {
      loadParticipants();
      
      // Subscribe to real-time changes in auction_participants
      const channel = supabase
        .channel('lobby-changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'auction_participants',
          filter: `auction_id=eq.${activeAuction.auction_id}`
        }, () => {
          loadParticipants();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeAuction]);

  useEffect(() => {
    // Subscribe to auction status changes
    const auctionChannel = supabase
      .channel('auction-status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'auctions',
      }, () => {
        checkActiveAuction();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(auctionChannel);
    };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    setCurrentUserEmail(session.user.email || null);
    setLoading(false);
  };

  const checkActiveAuction = async () => {
    const { data } = await supabase
      .from('auctions')
      .select('*')
      .in('status', ['draft', 'active', 'round1', 'round2'])
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .single();

    setActiveAuction(data);
  };

  const loadParticipants = async () => {
    if (!activeAuction) return;

    // ✅ NEW WAY - Query auction_participants with manager details
    const { data } = await supabase
      .from('auction_participants')
      .select(`
        participant_id,
        starting_budget,
        current_budget,
        is_ready,
        managers (
          manager_id,
          manager_name,
          email,
          role
        )
      `)
      .eq('auction_id', activeAuction.auction_id)
      .order('managers(manager_name)');

    if (data) {
      setParticipants(data as any);
      
      // Find current user's participant record
      if (currentUserEmail) {
        const current = data.find((p: any) => p.managers.email === currentUserEmail);
        if (current) {
          setCurrentParticipant(current as any);
        }
      }
    }
  };

  const toggleReady = async () => {
    if (!currentParticipant || !activeAuction) return;
    
    const newReadyState = !currentParticipant.is_ready;
    
    // ✅ NEW WAY - Update auction_participants table
    await supabase
      .from('auction_participants')
      .update({ 
        is_ready: newReadyState
      })
      .eq('participant_id', currentParticipant.participant_id);
    
    // Refresh participants list
    loadParticipants();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const startAuction = () => {
    router.push('/admin/setup');
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

  if (!activeAuction) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
        color: 'white',
        padding: '20px',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '15px' }}>No Active Auction</h1>
        <p style={{ marginBottom: '20px', opacity: 0.8 }}>
          Wait for admin to create an auction
        </p>
        <button
          onClick={() => router.push('/home')}
          style={{
            padding: '10px 30px',
            background: 'white',
            color: '#02084b',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Go to Home
        </button>
      </div>
    );
  }

  const readyCount = participants.filter(p => p.is_ready).length;
  const allReady = readyCount === participants.length && participants.length > 0;
  const isAdmin = currentParticipant?.managers.role === 'admin';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
      padding: '15px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        maxWidth: '800px',
        width: '100%',
        background: 'white',
        padding: '25px',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(2, 8, 75, 0.2)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px',
        }}>
          <div>
            <h1 style={{ fontSize: '24px', color: '#02084b', marginBottom: '3px' }}>
              🎯 AuctionLab Lobby
            </h1>
            <p style={{ color: '#666', fontSize: '12px' }}>
              {activeAuction.auction_name || 'Auction Lobby'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 15px',
              background: '#fff',
              color: '#02084b',
              border: '2px solid #02084b',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Logout
          </button>
        </div>

        {/* Status */}
        <div style={{
          background: '#e3f2fd',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '15px',
          textAlign: 'center',
        }}>
          <h2 style={{ color: '#02084b', marginBottom: '5px', fontSize: '18px' }}>
            Participants Ready: {readyCount}/{participants.length}
          </h2>
          {allReady ? (
            <p style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '13px', margin: 0 }}>
              ✅ All participants ready! Admin can start auction.
            </p>
          ) : (
            <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>
              Waiting for all participants...
            </p>
          )}
        </div>

        {/* Participant List */}
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ color: '#02084b', marginBottom: '10px', fontSize: '16px' }}>
            Participants ({participants.length})
          </h3>
          <div style={{
            display: 'grid',
            gap: '8px',
            maxHeight: '280px',
            overflowY: 'auto',
          }}>
            {participants.map((participant) => {
              const isCurrentUser = participant.managers.email === currentUserEmail;
              
              return (
                <div
                  key={participant.participant_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px',
                    background: isCurrentUser ? '#e3f2fd' : '#f8f9fa',
                    borderRadius: '6px',
                    border: isCurrentUser 
                      ? '2px solid #02084b' 
                      : '1px solid #ddd',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🟢</span>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#02084b', fontSize: '13px' }}>
                        {participant.managers.manager_name}
                        {participant.managers.role === 'admin' && ' (Admin)'}
                        {isCurrentUser && ' (You)'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        Budget: {participant.current_budget} pts
                      </div>
                    </div>
                  </div>
                  <div>
                    {participant.is_ready ? (
                      <span style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '12px' }}>
                        ✅ Ready
                      </span>
                    ) : (
                      <span style={{ color: '#f57c00', fontSize: '12px' }}>
                        ⏳ Waiting
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'center',
          marginBottom: '12px',
        }}>
          {currentParticipant && (
            <button
              onClick={toggleReady}
              style={{
                padding: '10px 30px',
                fontSize: '14px',
                fontWeight: 'bold',
                background: currentParticipant.is_ready ? '#f57c00' : '#2e7d32',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              {currentParticipant.is_ready ? '❌ Not Ready' : '✅ I\'m Ready'}
            </button>
          )}

          {isAdmin && activeAuction.status === 'draft' && (
            <button
              onClick={startAuction}
              disabled={!allReady}
              style={{
                padding: '10px 30px',
                fontSize: '14px',
                fontWeight: 'bold',
                background: allReady ? '#02084b' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: allReady ? 'pointer' : 'not-allowed',
              }}
            >
              🎬 Start Auction
            </button>
          )}

          {activeAuction.status !== 'draft' && (
            <button
              onClick={() => router.push('/auction')}
              style={{
                padding: '10px 30px',
                fontSize: '14px',
                fontWeight: 'bold',
                background: '#2e7d32',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              🔴 Join Auction
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          paddingTop: '12px',
          borderTop: '1px solid #eee',
          color: '#999',
          fontSize: '11px',
        }}>
          Powered by <strong style={{ color: '#02084b' }}>NB Blue Studios</strong>
        </div>
      </div>
    </div>
  );
}