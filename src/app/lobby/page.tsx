'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Manager {
  manager_id: number;
  manager_name: string;
  email: string;
  role: string;
  starting_budget: number;
  current_budget: number;
  team_name?: string;
  is_ready: boolean;
  is_online: boolean;
}

export default function LobbyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Manager | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [activeAuction, setActiveAuction] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    loadManagers();
    checkActiveAuction();
    
    // Subscribe to real-time changes
    const channel = supabase
      .channel('lobby-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'managers' 
      }, () => {
        loadManagers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    // Subscribe to auction changes
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
    setIsReady(mgr.is_ready || false);
    setLoading(false);
  };

  const loadManagers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
  
    const { data } = await supabase
      .from('managers')
      .select('*')
      .order('manager_name');

    if (data) {
      const managersWithStatus = data.map(m => ({
        ...m,
        is_online: true,
      }));
      setManagers(managersWithStatus);
    
      if (session?.user?.email) {
        const current = managersWithStatus.find(m => m.email === session.user.email);
        if (current) {
          setCurrentUser(current);
          setIsReady(current.is_ready || false);
        }
      }
    }
  };

  const checkActiveAuction = async () => {
    const { data } = await supabase
      .from('auctions')
      .select('*')
      .in('status', ['active', 'round1', 'round2'])
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .single();

    setActiveAuction(data);
  };
  
  const toggleReady = async () => {
    if (!currentUser) return;
    
    const newReadyState = !isReady;
    setIsReady(newReadyState);
    
    await supabase
      .from('managers')
      .update({ 
        is_ready: newReadyState,
        updated_at: new Date().toISOString()
      })
      .eq('manager_id', currentUser.manager_id);
    
    loadManagers();
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

  const playingManagers = managers.filter(m => m.starting_budget > 0);
  const readyCount = playingManagers.filter(m => m.is_ready).length;
  const allReady = readyCount === playingManagers.length;

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
              🏏 Cricket Auction Lobby
            </h1>
            <p style={{ color: '#666', fontSize: '12px' }}>
              Welcome, {currentUser?.manager_name}!
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
            Managers Ready: {readyCount}/{playingManagers.length}
          </h2>
          {allReady ? (
            <p style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '13px', margin: 0 }}>
              ✅ All managers ready! Admin can start auction.
            </p>
          ) : (
            <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>
              Waiting for all managers...
            </p>
          )}
        </div>

        {/* Manager List */}
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ color: '#02084b', marginBottom: '10px', fontSize: '16px' }}>
            Managers ({playingManagers.length})
          </h3>
          <div style={{
            display: 'grid',
            gap: '8px',
            maxHeight: '280px',
            overflowY: 'auto',
          }}>
            {playingManagers.map((manager) => (
              <div
                key={manager.manager_id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  background: currentUser?.manager_id === manager.manager_id ? '#e3f2fd' : '#f8f9fa',
                  borderRadius: '6px',
                  border: currentUser?.manager_id === manager.manager_id 
                    ? '2px solid #02084b' 
                    : '1px solid #ddd',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>
                    {manager.is_online ? '🟢' : '⚫'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#02084b', fontSize: '13px' }}>
                      {manager.manager_name}
                      {manager.role === 'admin' && ' (Admin)'}
                      {currentUser?.manager_id === manager.manager_id && ' (You)'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>
                      {manager.current_budget} pts
                      {manager.team_name && ` • ${manager.team_name}`}
                    </div>
                  </div>
                </div>
                <div>
                  {manager.is_ready ? (
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
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'center',
          marginBottom: '12px',
        }}>
          {currentUser && currentUser.current_budget > 0 && (
            <button
              onClick={toggleReady}
              style={{
                padding: '10px 30px',
                fontSize: '14px',
                fontWeight: 'bold',
                background: isReady ? '#f57c00' : '#2e7d32',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              {isReady ? '❌ Not Ready' : '✅ I\'m Ready'}
            </button>
          )}

          {currentUser?.role === 'admin' && !activeAuction && (
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

          {activeAuction && (
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
