'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Manager {
  manager_id: number;
  manager_name: string;
  email: string;
  role: string;
  current_budget: number;
  starting_budget: number;
  team_name?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<Manager | null>(null);
  const [auctionActive, setAuctionActive] = useState(false);

  useEffect(() => {
    checkAuth();
    checkAuctionStatus();
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

    setManager(mgr);
    setLoading(false);
  };

  const checkAuctionStatus = async () => {
   const { data } = await supabase
     .from('auctions')
     .select('status')
     .in('status', ['draft', 'active', 'round1', 'round2'])
     .limit(1);

   setAuctionActive(Boolean(data && data.length > 0));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const joinLobby = () => {
    router.push('/lobby');
  };

  const goToSetup = () => {
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
        maxWidth: '1000px',
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
          marginBottom: '20px',
          paddingBottom: '15px',
          borderBottom: '2px solid #eee',
        }}>
          <div>
            <h1 style={{ fontSize: '24px', color: '#02084b', marginBottom: '3px' }}>
              🏏 Cricket Auction Hub
            </h1>
            <p style={{ color: '#666', fontSize: '13px' }}>
              Welcome back, <strong>{manager?.manager_name}</strong>!
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 20px',
              background: 'transparent',
              color: '#02084b',
              border: '2px solid #02084b',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
            }}
          >
            Logout
          </button>
        </div>

        {/* Profile Card */}
        <div style={{
          background: '#f8f9fa',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '15px',
        }}>
          <h2 style={{ color: '#02084b', marginBottom: '12px', fontSize: '16px' }}>
            Your Profile
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '15px',
          }}>
            <div>
              <p style={{ color: '#666', fontSize: '11px', marginBottom: '3px' }}>Manager Name</p>
              <p style={{ color: '#02084b', fontSize: '14px', fontWeight: 'bold' }}>
                {manager?.manager_name}
              </p>
            </div>
            <div>
              <p style={{ color: '#666', fontSize: '11px', marginBottom: '3px' }}>Role</p>
              <p style={{ color: '#02084b', fontSize: '14px', fontWeight: 'bold' }}>
                {manager?.role === 'admin' ? '👑 Admin' : '👤 Manager'}
              </p>
            </div>
            <div>
              <p style={{ color: '#666', fontSize: '11px', marginBottom: '3px' }}>Budget</p>
              <p style={{ color: '#02084b', fontSize: '14px', fontWeight: 'bold' }}>
                {manager?.current_budget} / {manager?.starting_budget} pts
              </p>
            </div>
            {manager?.team_name && (
              <div>
                <p style={{ color: '#666', fontSize: '11px', marginBottom: '3px' }}>Team Name</p>
                <p style={{ color: '#02084b', fontSize: '14px', fontWeight: 'bold' }}>
                  {manager.team_name}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Auction Status */}
        {auctionActive ? (
          <div style={{
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '15px',
            textAlign: 'center',
          }}>
            <h2 style={{ color: '#155724', marginBottom: '8px', fontSize: '16px' }}>
              🎪 Auction is Active!
            </h2>
            <p style={{ color: '#155724', marginBottom: '12px', fontSize: '12px' }}>
              Join the lobby to participate in the live auction
            </p>
            <button
              onClick={joinLobby}
              style={{
                padding: '10px 30px',
                fontSize: '14px',
                fontWeight: 'bold',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Join Auction Lobby →
            </button>
          </div>
        ) : (
          <div style={{
            background: '#fff3cd',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '15px',
            textAlign: 'center',
          }}>
            <h2 style={{ color: '#856404', marginBottom: '8px', fontSize: '16px' }}>
              ⏸️ No Active Auction
            </h2>
            <p style={{ color: '#856404', fontSize: '12px', marginBottom: manager?.role === 'admin' ? '12px' : '0' }}>
              {manager?.role === 'admin' 
                ? 'Start a new auction to begin bidding'
                : 'Wait for admin to start the auction'}
            </p>
            {manager?.role === 'admin' && (
              <button
                onClick={goToSetup}
                style={{
                  padding: '10px 30px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  background: '#02084b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Create New Auction →
              </button>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '15px',
          marginBottom: '15px',
        }}>
          <div style={{
            padding: '15px',
            background: '#e3f2fd',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '28px', marginBottom: '5px' }}>📊</p>
            <h3 style={{ color: '#02084b', marginBottom: '5px', fontSize: '14px' }}>My Team</h3>
            <p style={{ color: '#666', fontSize: '11px', marginBottom: '10px' }}>
              View your squad
            </p>
            <button
              style={{
                padding: '8px 16px',
                background: '#02084b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                width: '100%',
              }}
            >
              View Team
            </button>
          </div>

          <div style={{
            padding: '15px',
            background: '#f3e5f5',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '28px', marginBottom: '5px' }}>📈</p>
            <h3 style={{ color: '#02084b', marginBottom: '5px', fontSize: '14px' }}>Reports</h3>
            <p style={{ color: '#666', fontSize: '11px', marginBottom: '10px' }}>
              Download auction data
            </p>
            <button
              style={{
                padding: '8px 16px',
                background: '#6a1b9a',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                width: '100%',
              }}
            >
              View Reports
            </button>
          </div>

          <div style={{
            padding: '15px',
            background: '#fff3e0',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '28px', marginBottom: '5px' }}>🏆</p>
            <h3 style={{ color: '#02084b', marginBottom: '5px', fontSize: '14px' }}>History</h3>
            <p style={{ color: '#666', fontSize: '11px', marginBottom: '10px' }}>
              Past auctions
            </p>
            <button
              onClick={() => router.push('/admin/history')}
              style={{
                padding: '8px 16px',
                background: '#e65100',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                width: '100%',
              }}
            >
              View History
            </button>
          </div>
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
