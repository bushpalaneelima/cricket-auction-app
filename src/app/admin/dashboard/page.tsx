'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<any>(null);

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

    if (!mgr || mgr.role !== 'admin') {
      alert('Admin access only!');
      router.push('/login');
      return;
    }

    setManager(mgr);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
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
      padding: '40px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'white',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '40px',
        }}>
          <div>
            <h1 style={{ fontSize: '32px', color: '#02084b', marginBottom: '10px' }}>
              🏏 Admin Dashboard
            </h1>
            <p style={{ color: '#666' }}>
              Welcome, {manager?.manager_name}!
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '12px 24px',
              background: '#02084b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Logout
          </button>
        </div>

        <div style={{
          background: '#e3f2fd',
          padding: '30px',
          borderRadius: '12px',
          textAlign: 'center',
        }}>
          <h2 style={{ color: '#02084b', marginBottom: '20px' }}>
            ✅ Login System Working!
          </h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Authentication successful. Admin dashboard is ready.
          </p>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginTop: '20px',
          }}>
            <p><strong>Your Details:</strong></p>
            <p>Name: {manager?.manager_name}</p>
            <p>Email: {manager?.email}</p>
            <p>Role: {manager?.role}</p>
            <p>Budget: {manager?.current_budget} points</p>
          </div>
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center', color: '#666' }}>
          <p>Next steps: Build lobby and auction pages!</p>
        </div>
      </div>
    </div>
  );
}