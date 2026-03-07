'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function AuctionSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<any>(null);
  const [allManagers, setAllManagers] = useState<any[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<number[]>([]);
  
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

  // ✅ MAPPING FUNCTION
  const getTournamentColumn = (displayName: string): string => {
    const mapping: { [key: string]: string } = {
      'T20 World Cup': 't20_wc_active',
      'ODI World Cup': 'odi_wc_active',
      'Indian Premier League': 'ipl_active',
      'Champions Trophy': 'champions_active',
      'Women Premier League': 'wpl_active',
      'WODI World Cup': 'wodi_wc_active',
      'WT20 World Cup': 'wt20_wc_active',
      'Other': ''
    };
    return mapping[displayName] || '';
  };

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
    
    // ✅ Load all managers for selection
    await loadManagers();
    
    setLoading(false);
  };

  const loadManagers = async () => {
    // ✅ FIXED: Remove role filter - show ALL managers including admins
    const { data } = await supabase
      .from('managers')
      .select('*')
      .order('manager_name');

    if (data) {
      setAllManagers(data);
      // Pre-select only regular managers (not admins) by default
      const regularManagers = data.filter(m => m.role !== 'admin').map(m => m.manager_id);
      setSelectedManagers(regularManagers);
    }
  };

  const toggleManager = (managerId: number) => {
    if (selectedManagers.includes(managerId)) {
      setSelectedManagers(selectedManagers.filter(id => id !== managerId));
    } else {
      setSelectedManagers([...selectedManagers, managerId]);
    }
  };

  const handleStartAuction = async () => {
    if (!auctionName || !tournament) {
      alert('Please fill auction name and tournament!');
      return;
    }

    if (selectedManagers.length === 0) {
      alert('Please select at least one participant!');
      return;
    }

    const confirmed = confirm(
      '🚨 Create New Auction?\n\n' +
      `Auction Name: ${auctionName}\n` +
      `Tournament: ${tournament}\n` +
      `Participants: ${selectedManagers.length} managers\n\n` +
      'This will:\n' +
      '1. Create a new auction\n' +
      '2. Add selected managers as participants\n' +
      '3. Each will start with 1000 pts budget\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    try {
      console.log('🎬 Creating new auction...');

      // ✅ STEP 1: Create auction
      const tournamentColumn = getTournamentColumn(tournament);
      
      const { data: auction, error: auctionError } = await supabase
        .from('auctions')
        .insert([
          {
            auction_name: auctionName,
            tournament_filter: tournamentColumn,
            class_filter: playerClass,
            role_filter: role,
            scheduled_at: new Date().toISOString(),
            status: 'active', // ✅ FIXED: Changed from 'draft' to 'active'
            timer_seconds: 30,
            is_paused: false,
            current_player_id: null,
            current_bid_amount: 0,
            current_bid_participant_id: null
          }
        ])
        .select()
        .single();

      if (auctionError) throw auctionError;

      console.log('✅ Auction created:', auction.auction_id);

      // ✅ STEP 2: Add selected managers to auction_participants
      const participants = selectedManagers.map(managerId => ({
        auction_id: auction.auction_id,
        manager_id: managerId,
        starting_budget: 1000,
        current_budget: 1000,
        is_ready: false
      }));

      const { error: participantsError } = await supabase
        .from('auction_participants')
        .insert(participants);

      if (participantsError) throw participantsError;

      console.log(`✅ Added ${selectedManagers.length} participants to auction`);

      alert(
        `✅ Auction "${auctionName}" created!\n\n` +
        `Auction ID: ${auction.auction_id}\n` +
        `Participants: ${selectedManagers.length} managers\n` +
        `Status: Active (participants can now join lobby)\n\n` +
        `Redirecting to lobby...`
      );

      // ✅ Redirect to lobby
      router.push('/lobby');
      
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
        maxWidth: '700px',
        width: '100%',
        background: 'white',
        padding: '25px',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(2, 8, 75, 0.2)',
        maxHeight: '90vh',
        overflowY: 'auto',
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
            Select participants and configure auction settings
          </p>
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
              placeholder="e.g., T20 World Cup 2026"
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

          {/* Starting Filters */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginBottom: '20px'
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

          {/* ✅ Manager Selection */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#02084b',
              fontWeight: '600',
              fontSize: '13px'
            }}>
              Select Participants ({selectedManagers.length} selected)
            </label>
            <div style={{
              border: '2px solid #ddd',
              borderRadius: '6px',
              padding: '10px',
              maxHeight: '200px',
              overflowY: 'auto',
            }}>
              {allManagers.map(mgr => (
                <label
                  key={mgr.manager_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    background: selectedManagers.includes(mgr.manager_id) ? '#e3f2fd' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedManagers.includes(mgr.manager_id)}
                    onChange={() => toggleManager(mgr.manager_id)}
                    style={{ marginRight: '10px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', color: '#02084b' }}>
                    {mgr.manager_name}
                    {mgr.role === 'admin' && ' 👑'}
                  </span>
                </label>
              ))}
            </div>
          </div>
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
            disabled={!auctionName || !tournament || selectedManagers.length === 0}
            style={{
              padding: '12px 30px',
              fontSize: '14px',
              fontWeight: '600',
              background: (!auctionName || !tournament || selectedManagers.length === 0) ? '#ccc' : '#02084b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (!auctionName || !tournament || selectedManagers.length === 0) ? 'not-allowed' : 'pointer',
            }}
          >
            🚀 Create Auction
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