'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { getAuctionAccess } from '../lib/accessControl';

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
  const [access, setAccess] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeAuction, setActiveAuction] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    checkActiveAuction();
  }, []);

  useEffect(() => {
    if (activeAuction && currentUserEmail) {
      checkAccess();
      loadParticipants();
      
      // Subscribe to real-time changes
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
  }, [activeAuction, currentUserEmail]);

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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: mgr } = await supabase
    .from('managers')
    .select('manager_id, role')
    .eq('email', session.user.email)
    .single();

  if (!mgr) return;

  if (mgr.role === 'admin') {
    const { data } = await supabase
      .from('auctions')
      .select('*')
      .in('status', ['draft', 'active', 'round1', 'round2'])
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .single();
    setActiveAuction(data);
  } else {
    const { data: participation } = await supabase
      .from('auction_participants')
      .select('auction_id, auctions(*)')
      .eq('manager_id', mgr.manager_id)
      .order('auction_id', { ascending: false })
      .limit(1)
      .single();
    setActiveAuction((participation?.auctions as any) || null);
  }
};
  const checkAccess = async () => {
    if (!currentUserEmail || !activeAuction) return;

    const accessInfo = await getAuctionAccess(
      currentUserEmail,
      activeAuction.auction_id
    );

    // If user cannot view this auction, redirect
    if (!accessInfo.canView) {
      alert('You do not have access to this auction.');
      router.push('/home');
      return;
    }

    setAccess(accessInfo);
  };

  const loadParticipants = async () => {
    if (!activeAuction) return;

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
    }
  };

  const toggleReady = async () => {
    if (!access?.participantId) return;
    
    const currentParticipant = participants.find(
      p => p.participant_id === access.participantId
    );
    
    if (!currentParticipant) return;

    const newReadyState = !currentParticipant.is_ready;
    
    await supabase
      .from('auction_participants')
      .update({ is_ready: newReadyState })
      .eq('participant_id', access.participantId);
    
    loadParticipants();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

    const startAuction = async () => {
    if (!activeAuction) return;
    
    await supabase
      .from('auctions')
      .update({ status: 'active' })
      .eq('auction_id', activeAuction.auction_id);
    
    router.push(`/auction?id=${activeAuction.auction_id}`);
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

  if (!access) {
    return <div style={{ padding: '20px' }}>Checking access...</div>;
  }

  const readyCount = participants.filter(p => p.is_ready).length;
  const allReady = readyCount === participants.length && participants.length > 0;

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
              {access.isAdmin && !access.isParticipant && (
                <span style={{ marginLeft: '10px', color: '#ff9800', fontWeight: 'bold' }}>
                  👑 Viewing as Admin
                </span>
              )}
              {access.isAdmin && access.isParticipant && (
                <span style={{ marginLeft: '10px', color: '#4caf50', fontWeight: 'bold' }}>
                  👑 Admin & Playing
                </span>
              )}
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
                        {participant.managers.role === 'admin' && ' 👑'}
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
          {access.isParticipant && (
            <button
              onClick={toggleReady}
              style={{
                padding: '10px 30px',
                fontSize: '14px',
                fontWeight: 'bold',
                background: participants.find(p => p.participant_id === access.participantId)?.is_ready 
                  ? '#f57c00' 
                  : '#2e7d32',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              {participants.find(p => p.participant_id === access.participantId)?.is_ready 
                ? '❌ Not Ready' 
                : '✅ I\'m Ready'}
            </button>
          )}

          {access.canControl && activeAuction.status === 'draft' && (
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
              onClick={() => router.push(`/auction?id=${activeAuction.auction_id}`)}
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