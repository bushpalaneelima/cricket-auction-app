'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        await verifyManager(session.user.email);
      }
    };

    checkUser();
  }, []);

  const verifyManager = async (email: string | undefined) => {
    if (!email) {
      setError('No email found in your account');
      await supabase.auth.signOut();
      return;
    }

    const { data: manager, error: dbError } = await supabase
      .from('managers')
      .select('manager_name, role, email')
      .eq('email', email)
      .single();

    if (dbError || !manager) {
      setError('Your email is not registered. Please contact the admin.');
      await supabase.auth.signOut();
      return;
    }

    // Redirect based on role
    if (manager.role === 'admin') {
      router.push('/home');  // Changed from /lobby
      } else {
      router.push('/home'); // Changed from /lobby
      }
  };

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await verifyManager(data.user.email);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
    }}>
      <div style={{
        background: 'white',
        padding: '50px 70px',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(2, 8, 75, 0.3)',
        textAlign: 'center',
        maxWidth: '480px',
        width: '90%',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '30px' }}>
          <img 
            src="/logo.png" 
            alt="NB Blue Studios" 
            style={{ width: '200px', height: 'auto', margin: '0 auto', display: 'block' }}
          />
        </div>

        <h1 style={{
          fontSize: '28px',
          marginBottom: '10px',
          color: '#02084b',
          fontWeight: '700',
        }}>
          🏏 Cricket Auction Hub
        </h1>
        
        <p style={{
          color: '#2B2D42',
          marginBottom: '35px',
          fontSize: '16px',
          fontWeight: '400',
        }}>
          Sign in to participate in the live auction
        </p>

        {error && (
          <div style={{
            background: '#fee',
            border: '2px solid #c33',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '25px',
            color: '#c33',
            fontSize: '14px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={signInWithPassword} style={{ width: '100%' }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '16px',
              marginBottom: '15px',
              fontSize: '16px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              boxSizing: 'border-box',
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '16px',
              marginBottom: '25px',
              fontSize: '16px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              boxSizing: 'border-box',
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '16px',
              fontWeight: '600',
              backgroundColor: '#02084b',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{
          marginTop: '30px',
          fontSize: '13px',
          color: '#888',
          lineHeight: '1.6',
        }}>
          Only registered managers can sign in.<br/>
          Contact admin if you need access.
        </p>

        <div style={{
          marginTop: '25px',
          paddingTop: '20px',
          borderTop: '1px solid #eee',
          fontSize: '12px',
          color: '#999',
        }}>
          Powered by <span style={{ fontWeight: '700', color: '#02084b' }}>NB Blue Studios</span>
        </div>
      </div>
    </div>
  );
}