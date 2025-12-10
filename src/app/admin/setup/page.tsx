'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function AuctionSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<any>(null);
  
  // Filter states
  const [auctionName, setAuctionName] = useState('');
  const [tournament, setTournament] = useState('');
  const [playerClass, setPlayerClass] = useState('Platinum');
  const [role, setRole] = useState('Batsman');

  // Available options
  const tournaments = [
    'T20 World Cup',
    'ODI World Cup',
    'Indian Premier League',
    'Champions Trophy',
    'Women Premier League',
    'WODI World Cup',
    'WT20 World Cup',
    'Other'
  ];

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
      router.push('/home');
      return;
    }

    setManager(mgr);
    setLoading(false);
  };

  const handleStartAuction = async () => {
    if (!auctionName || !tournament) {
      alert('Please fill all fields!');
      return;
    }

    const confirmed = confirm(
      '🚨 This will:\n\n' +
      '1. Create a new auction\n' +
      '2. Reset ALL manager budgets to 1000 pts\n' +
      '3. Keep previous auction history intact\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    try {
      console.log('🎬 Creating new auction...');

      // STEP 1: Reset all manager budgets
      const { error: resetError } = await supabase
        .from('managers')
        .update({ 
          current_budget: 1000,
          is_ready: false 
        })
        .neq('manager_id', 0); // Update all managers

      if (resetError) {
        console.error('Error resetting budgets:', resetError);
        throw resetError;
      }

      console.log('✅ Manager budgets reset');

      // STEP 2: Create new auction
      const { data: auction, error: auctionError } = await supabase
        .from('auctions')
        .insert([
          {
            auction_name: auctionName,
            tournament_filter: tournament,
            class_filter: playerClass,
            role_filter: role,
            scheduled_at: new Date().toISOString(),
            status: 'active',
            timer_seconds: 30,
            is_paused: false,
            current_player_id: null,
            current_bid_amount: 0,
            current_bid_manager_id: null
          }
        ])
        .select()
        .single();

      if (auctionError) throw auctionError;

      console.log('✅ Auction created:', auction.auction_id);

      alert(`✅ Auction "${auctionName}" created!\n\nAuction ID: ${auction.auction_id}\nAll managers reset to 1000 pts.`);

      // Redirect to auction page
      router.push('/auction');
    } catch (error) {
      console.error('Error creating auction:', error);
      alert('Failed to create auction. Please check console for details.');
    }
  };

  const handleCancel = () => {
    router.push('/home');
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
        maxWidth: '600px',
        width: '100%',
        background: 'white',
        padding: '25px',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(2, 8, 75, 0.2)',
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          <h1 style={{ 
            fontSize: '24px', 
            color: '#02084b', 
            marginBottom: '5px' 
          }}>
            🎬 Create New Auction
          </h1>
          <p style={{ color: '#666', fontSize: '12px' }}>
            This will reset all manager budgets to 1000 pts
          </p>
        </div>

        {/* Warning Box */}
        <div style={{
          background: '#fff3cd',
          border: '2px solid #ffc107',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          <p style={{ color: '#856404', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
            ⚠️ Important:
          </p>
          <ul style={{ color: '#856404', fontSize: '12px', margin: 0, paddingLeft: '20px' }}>
            <li>Previous auction history will be preserved</li>
            <li>All manager budgets will reset to 1000 pts</li>
            <li>Players can be re-auctioned in the new auction</li>
          </ul>
        </div>

        {/* Form */}
        <div style={{ marginBottom: '20px' }}>
          {/* Auction Name */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '5px',
              color: '#02084b',
              fontWeight: '600',
              fontSize: '13px'
            }}>
              Auction Name *
            </label>
            <input
              type="text"
              value={auctionName}
              onChange={(e) => setAuctionName(e.target.value)}
              placeholder="e.g., IPL 2026 Mega Auction"
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

          {/* Tournament */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '5px',
              color: '#02084b',
              fontWeight: '600',
              fontSize: '13px'
            }}>
              Tournament *
            </label>
            <select
              value={tournament}
              onChange={(e) => setTournament(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: '2px solid #ddd',
                borderRadius: '6px',
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
            >
              <option value="">-- Select Tournament --</option>
              {tournaments.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Starting Filters - 2 Column Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginBottom: '15px'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '5px',
                color: '#02084b',
                fontWeight: '600',
                fontSize: '13px'
              }}>
                Starting Class
              </label>
              <select
                value={playerClass}
                onChange={(e) => setPlayerClass(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                <option value="Platinum">Platinum</option>
                <option value="Gold">Gold</option>
                <option value="Silver">Silver</option>
                <option value="Copper">Copper</option>
                <option value="Bronze">Bronze</option>
                <option value="Stone">Stone</option>
              </select>
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '5px',
                color: '#02084b',
                fontWeight: '600',
                fontSize: '13px'
              }}>
                Starting Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                <option value="Batsman">Batsman</option>
                <option value="Bowler">Bowler</option>
                <option value="All-rounder">All-rounder</option>
                <option value="Wicket Keeper">Wicket Keeper</option>
              </select>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div style={{
          background: '#e3f2fd',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '20px',
        }}>
          <p style={{ 
            color: '#02084b', 
            fontSize: '11px', 
            margin: 0,
            lineHeight: '1.5'
          }}>
            💡 Auction will progress automatically through all 6 classes (Platinum → Gold → Silver → Copper → Bronze → Stone) and all 4 roles (Batsmen → Bowlers → All-rounders → Wicket Keepers)
          </p>
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'center',
          marginBottom: '15px',
        }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '12px 30px',
              fontSize: '14px',
              fontWeight: '600',
              background: 'white',
              color: '#02084b',
              border: '2px solid #02084b',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleStartAuction}
            disabled={!auctionName || !tournament}
            style={{
              padding: '12px 30px',
              fontSize: '14px',
              fontWeight: '600',
              background: (!auctionName || !tournament) ? '#ccc' : '#02084b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (!auctionName || !tournament) ? 'not-allowed' : 'pointer',
            }}
          >
            🚀 Create & Start Auction
          </button>
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
