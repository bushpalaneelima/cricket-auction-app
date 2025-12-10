'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Player {
  player_id: number;
  player_name: string;
  country: string;
  role: string;
  class_band: string;
  base_price: number;
  ipl_team?: string;
  role_detail?: string;
}

interface TeamPlayer extends Player {
  price: number;
}

interface Manager {
  manager_id: number;
  manager_name: string;
  email: string;
  role: string;
  current_budget: number;
  starting_budget: number;
  team_name?: string;
}

interface AuctionState {
  auction_id: number;
  current_player_id: number | null;
  current_bid_amount: number;
  current_bid_manager_id: number | null;
  timer_seconds: number;
  is_paused: boolean;
  status: string;
  tournament_filter: string;
  class_filter: string;
  role_filter: string;
}

interface RoleCounts {
  Batsman: number;
  Bowler: number;
  'All-rounder': number;
  'Wicket Keeper': number;
}

export default function AuctionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Manager | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [currentBidder, setCurrentBidder] = useState<Manager | null>(null);
  const [myTeam, setMyTeam] = useState<TeamPlayer[]>([]);
  const [isFrozen, setIsFrozen] = useState(false);
  const [freezeMessage, setFreezeMessage] = useState('');
  
  // Filter controls
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  // Ref to track if we should sell player when timer hits 0
  const shouldSellRef = useRef(false);
  const isProcessingSaleRef = useRef(false);

  useEffect(() => {
    checkAuth();
  }, []);

  // Update filter selections when auction state changes
  useEffect(() => {
    if (auctionState) {
      setSelectedClass(auctionState.class_filter || '');
      setSelectedRole(auctionState.role_filter || '');
    }
  }, [auctionState?.class_filter, auctionState?.role_filter]);

  // Subscribe to auction changes
  useEffect(() => {
    if (!auctionState || !currentUser) return;

    const channel = supabase
      .channel('auction-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'auctions',
        filter: `auction_id=eq.${auctionState.auction_id}`,
      }, (payload) => {
        console.log('Auction updated:', payload);
        
        // Directly update state
        if (payload.new) {
          const newAuction = payload.new as AuctionState;
          setAuctionState({...newAuction});
          
          // ALWAYS reload bidder when bid amount or bidder changes
          if (newAuction.current_bid_manager_id) {
            supabase
              .from('managers')
              .select('*')
              .eq('manager_id', newAuction.current_bid_manager_id)
              .single()
              .then(({ data }) => {
                setCurrentBidder(data);
              });
          } else {
            setCurrentBidder(null);
          }
          
          // ALWAYS reload player when player changes
          if (newAuction.current_player_id) {
            supabase
              .from('players')
              .select('*')
              .eq('player_id', newAuction.current_player_id)
              .single()
              .then(({ data }) => {
                if (data) setCurrentPlayer(data);
              });
          }
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'team_players',
      }, (payload) => {
        console.log('Player sold:', payload);
        if (currentUser) {
          refreshCurrentUser();
          loadMyTeam(currentUser.manager_id);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'managers',
        filter: `manager_id=eq.${currentUser.manager_id}`,
      }, (payload) => {
        console.log('Manager updated:', payload);
        refreshCurrentUser();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auctionState?.auction_id, currentUser?.manager_id]);

  const refreshCurrentUser = async () => {
    if (!currentUser) return;
    
    const { data: updatedUser } = await supabase
      .from('managers')
      .select('*')
      .eq('manager_id', currentUser.manager_id)
      .single();
    
    if (updatedUser) {
      setCurrentUser(updatedUser);
    }
  };

  // Timer countdown (only for admin) - Updates database every second
  useEffect(() => {
    if (!auctionState || !currentUser) return;
    if (currentUser.role !== 'admin') return;
    if (auctionState.is_paused || !currentPlayer) return;

    console.log('⏰ Timer useEffect started for player:', currentPlayer.player_name, '(ID:', currentPlayer.player_id, ')');

    const interval = setInterval(async () => {
      const { data: currentAuction } = await supabase
        .from('auctions')
        .select('timer_seconds')
        .eq('auction_id', auctionState.auction_id)
        .single();

      if (!currentAuction) {
        console.log('⚠️ Could not fetch auction for timer tick');
        return;
      }

      const newTime = currentAuction.timer_seconds - 1;
      console.log('⏱️ Timer tick:', newTime, 'for player:', currentPlayer.player_name);

      if (newTime <= 0) {
        console.log('🛑 Timer hit 0 for:', currentPlayer.player_name);
        clearInterval(interval);
        
        // Update DB to 0
        await supabase
          .from('auctions')
          .update({ timer_seconds: 0 })
          .eq('auction_id', auctionState.auction_id);
        
        // Call handlePlayerSold DIRECTLY
        console.log('🔔 Calling handlePlayerSold directly...');
        await handlePlayerSold();
      } else {
        // Update database - this will trigger real-time sync for all users
        await supabase
          .from('auctions')
          .update({ timer_seconds: newTime })
          .eq('auction_id', auctionState.auction_id);
      }
    }, 1000);

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up timer interval for player:', currentPlayer.player_name);
      clearInterval(interval);
    };
  }, [auctionState?.auction_id, auctionState?.is_paused, currentPlayer?.player_id, currentUser?.role]);

  // Separate effect to handle selling when SKIP button is used
  useEffect(() => {
    if (shouldSellRef.current && auctionState && currentPlayer) {
      console.log('🔔 Executing player sale from ref...');
      shouldSellRef.current = false;
      handlePlayerSold();
    }
  }, [shouldSellRef.current]); 

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
    loadMyTeam(mgr.manager_id);
    await loadAuctionState();
    setLoading(false);
  };

  const loadAuctionState = async () => {
    const { data: auction } = await supabase
      .from('auctions')
      .select('*')
      .in('status', ['active', 'round1', 'round2'])
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .single();

    if (!auction) {
      alert('No active auction found!');
      router.push('/lobby');
      return;
    }

    setAuctionState(auction);

    if (auction.current_player_id) {
      const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('player_id', auction.current_player_id)
        .single();

      setCurrentPlayer(player);
    } else {
      if (auction.tournament_filter) {
        await loadNextPlayer(auction);
      }
    }

    if (auction.current_bid_manager_id) {
      const { data: bidder } = await supabase
        .from('managers')
        .select('*')
        .eq('manager_id', auction.current_bid_manager_id)
        .single();

      setCurrentBidder(bidder);
    } else {
      setCurrentBidder(null);
    }
  };

  const loadNextPlayer = async (auction: AuctionState) => {
    try {
      console.log('📥 Loading next player...');
      console.log('🔍 Current filters:', auction.class_filter, auction.role_filter);
      console.log('🔍 Auction ID:', auction.auction_id);
      
      // Get sold players
      const { data: soldPlayers } = await supabase
        .from('team_players')
        .select('player_id');

      const soldPlayerIds = soldPlayers?.map(p => p.player_id) || [];
      console.log('✅ Sold players:', soldPlayerIds.length, soldPlayerIds);

      // Get unsold players  
      const { data: unsoldPlayers, error: unsoldError } = await supabase
        .from('unsold_players')
        .select('player_id')
        .eq('auction_id', auction.auction_id);

      if (unsoldError) {
        console.error('❌ Error fetching unsold players:', unsoldError);
      }

      const unsoldPlayerIds = unsoldPlayers?.map(p => p.player_id) || [];
      console.log('⏭️ Unsold players:', unsoldPlayerIds.length, unsoldPlayerIds);

      // Combine both lists - exclude BOTH sold AND unsold players
      const excludedPlayerIds = [...soldPlayerIds, ...unsoldPlayerIds];
      console.log('🚫 Total excluded:', excludedPlayerIds.length, excludedPlayerIds);

      let queryBuilder = supabase
        .from('players')
        .select('*');

      if (auction.class_filter) {
        queryBuilder = queryBuilder.eq('class_band', auction.class_filter);
      }
      
      if (auction.role_filter) {
        queryBuilder = queryBuilder.eq('role', auction.role_filter);
      }

      if (excludedPlayerIds.length > 0) {
        queryBuilder = queryBuilder.not('player_id', 'in', `(${excludedPlayerIds.join(',')})`);
      }

      console.log('🔎 Querying players with filters...');

      const { data: players, error } = await queryBuilder;

      if (error) {
        console.error('Query error:', error);
        alert('Error loading players: ' + error.message);
        return;
      }

      console.log('📊 Query returned', players?.length || 0, 'players');
      if (players && players.length > 0) {
        console.log('🎯 Available players:', players.map(p => `${p.player_name} (${p.player_id})`).slice(0, 5));
      }

      if (players && players.length > 0) {
        const randomIndex = Math.floor(Math.random() * players.length);
        const newPlayer = players[randomIndex];

        console.log('✅ Selected player:', newPlayer.player_name, `(ID: ${newPlayer.player_id})`);

        await supabase
          .from('auctions')
          .update({
            current_player_id: newPlayer.player_id,
            current_bid_amount: 0,
            current_bid_manager_id: null,
            timer_seconds: 30,
          })
          .eq('auction_id', auction.auction_id);

        setCurrentPlayer(newPlayer);
        return;
      }

      // NO PLAYERS FOUND - Auto-progress to next category
      console.log('No players in current category, auto-progressing...');
      
      // ✅ ALL 6 CLASSES INCLUDED
      const categories = [
        { class: 'Platinum', role: 'Batsman' },
        { class: 'Platinum', role: 'Bowler' },
        { class: 'Platinum', role: 'All-rounder' },
        { class: 'Platinum', role: 'Wicket Keeper' },
        { class: 'Gold', role: 'Batsman' },
        { class: 'Gold', role: 'Bowler' },
        { class: 'Gold', role: 'All-rounder' },
        { class: 'Gold', role: 'Wicket Keeper' },
        { class: 'Silver', role: 'Batsman' },
        { class: 'Silver', role: 'Bowler' },
        { class: 'Silver', role: 'All-rounder' },
        { class: 'Silver', role: 'Wicket Keeper' },
        { class: 'Copper', role: 'Batsman' },
        { class: 'Copper', role: 'Bowler' },
        { class: 'Copper', role: 'All-rounder' },
        { class: 'Copper', role: 'Wicket Keeper' },
        { class: 'Bronze', role: 'Batsman' },
        { class: 'Bronze', role: 'Bowler' },
        { class: 'Bronze', role: 'All-rounder' },
        { class: 'Bronze', role: 'Wicket Keeper' },
        { class: 'Stone', role: 'Batsman' },
        { class: 'Stone', role: 'Bowler' },
        { class: 'Stone', role: 'All-rounder' },
        { class: 'Stone', role: 'Wicket Keeper' },
      ];

      const currentIndex = categories.findIndex(
        cat => cat.class === auction.class_filter && cat.role === auction.role_filter
      );

      if (currentIndex >= 0 && currentIndex < categories.length - 1) {
        const nextCategory = categories[currentIndex + 1];
        
        console.log(`Moving from ${auction.class_filter} ${auction.role_filter} to ${nextCategory.class} ${nextCategory.role}`);
        
        const { error: updateError } = await supabase
          .from('auctions')
          .update({
            class_filter: nextCategory.class,
            role_filter: nextCategory.role,
          })
          .eq('auction_id', auction.auction_id);

        if (updateError) {
          console.error('Error updating filters:', updateError);
          alert('Error moving to next category');
          return;
        }

        const updatedAuction = { ...auction, class_filter: nextCategory.class, role_filter: nextCategory.role };
        await loadNextPlayer(updatedAuction);
        
      } else {
        alert('🎉 Auction Complete! All players have been sold!');
      }

    } catch (error) {
      console.error('Error loading player:', error);
      alert('Error: ' + error);
    }
  };

  const loadMyTeam = async (managerId: number) => {
    if (!auctionState) return;
    
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('team_players')
        .select('player_id, price')
        .eq('manager_id', managerId)
        .eq('auction_id', auctionState.auction_id);  // ✅ Filter by current auction

      if (teamError) {
        console.error('Error loading team players:', teamError);
        return;
      }

      if (!teamData || teamData.length === 0) {
        setMyTeam([]);
        return;
      }

      const playerIds = teamData.map(item => item.player_id);
      
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .in('player_id', playerIds);

      if (playersError) {
        console.error('Error loading players:', playersError);
        return;
      }

      if (playersData) {
        // Merge player data with prices
        const teamWithPrices = playersData.map(player => {
          const teamPlayer = teamData.find(tp => tp.player_id === player.player_id);
          return {
            ...player,
            price: teamPlayer?.price || 0
          };
        });
        setMyTeam(teamWithPrices);
      }
    } catch (error) {
      console.error('Error in loadMyTeam:', error);
    }
  };

  const handleBid = async () => {
    if (!currentUser || !currentPlayer || !auctionState) return;

    // Check 15-player limit
    if (myTeam.length >= 15) {
      alert('You have reached the maximum of 15 players!');
      return;
    }

    const nextBidAmount = getNextBidAmount();
    
    if (currentUser.current_budget < nextBidAmount) {
      alert('Insufficient budget!');
      return;
    }

    console.log('💰 Placing bid:', nextBidAmount, 'for', currentPlayer.player_name);

    await supabase
      .from('auctions')
      .update({
        current_bid_amount: nextBidAmount,
        current_bid_manager_id: currentUser.manager_id,
        timer_seconds: 30,
      })
      .eq('auction_id', auctionState.auction_id);

    const { error: bidError } = await supabase.from('bids').insert({
      auction_id: auctionState.auction_id,
      manager_id: currentUser.manager_id,
      player_id: currentPlayer.player_id,
      bid_amount: nextBidAmount,
    });

    if (bidError) {
      console.error('❌ Error saving bid:', bidError);
    } else {
      console.log('✅ Bid saved to history');
    }

    const { data: updatedUser } = await supabase
      .from('managers')
      .select('*')
      .eq('manager_id', currentUser.manager_id)
      .single();
    
    if (updatedUser) {
      setCurrentUser(updatedUser);
    }
  };

  const getNextBidAmount = () => {
    if (!auctionState || auctionState.current_bid_amount === 0) {
      return currentPlayer?.base_price || 5;
    }

    const current = auctionState.current_bid_amount;
    if (current < 100) return current + 5;
    if (current < 200) return current + 10;
    return current + 20;
  };

  const handlePlayerSold = async () => {
    console.log('🔔 handlePlayerSold called');
    
    // Prevent concurrent execution
    if (isProcessingSaleRef.current) {
      console.log('⚠️ Already processing a sale, skipping...');
      return;
    }
    
    isProcessingSaleRef.current = true;
    
    try {
      // IMPORTANT: Refetch latest auction state to avoid stale closures
      const { data: latestAuction } = await supabase
        .from('auctions')
        .select('*')
        .in('status', ['active', 'round1', 'round2'])
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .single();

      if (!latestAuction) {
        console.error('❌ Could not fetch auction state');
        return;
      }

      const { data: latestPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('player_id', latestAuction.current_player_id)
        .single();

      if (!latestPlayer) {
        console.error('❌ Could not fetch current player');
        return;
      }

      console.log('📋 Processing sale for:', latestPlayer.player_name);

      if (latestAuction.current_bid_manager_id && latestAuction.current_bid_amount > 0) {
        console.log('💰 Selling player to:', latestAuction.current_bid_manager_id, 'for', latestAuction.current_bid_amount);
        
        const { error: insertError } = await supabase.from('team_players').insert({
          auction_id: latestAuction.auction_id,  // ✅ Track which auction
          manager_id: latestAuction.current_bid_manager_id,
          player_id: latestPlayer.player_id,
          price: latestAuction.current_bid_amount,
          round: 1,
        });

        if (insertError) {
          console.error('❌ Error inserting team_players:', insertError);
        } else {
          console.log('✅ Player added to team_players');
        }

        const { data: manager } = await supabase
          .from('managers')
          .select('current_budget')
          .eq('manager_id', latestAuction.current_bid_manager_id)
          .single();

        if (manager) {
          const newBudget = manager.current_budget - latestAuction.current_bid_amount;
          console.log(`💸 Updating budget: ${manager.current_budget} → ${newBudget}`);
          
          await supabase
            .from('managers')
            .update({ 
              current_budget: newBudget
            })
            .eq('manager_id', latestAuction.current_bid_manager_id);
          
          console.log('✅ Budget updated');
        }
      } else {
        console.log('⏭️ No bids - marking player as UNSOLD');
        
        // Check if already marked as unsold (avoid duplicate constraint error)
        const { data: existingUnsold } = await supabase
          .from('unsold_players')
          .select('unsold_id')
          .eq('auction_id', latestAuction.auction_id)
          .eq('player_id', latestPlayer.player_id)
          .maybeSingle();

        if (existingUnsold) {
          console.log('⚠️ Player already in unsold_players, skipping insert');
        } else {
          // CRITICAL FIX: Add to unsold_players table (not team_players)
          const { error: unsoldError } = await supabase.from('unsold_players').insert({
            auction_id: latestAuction.auction_id,
            player_id: latestPlayer.player_id,
          });

          if (unsoldError) {
            console.error('❌ Error marking player as unsold:', unsoldError);
          } else {
            console.log('✅ Player marked as unsold (saved for Auction 2)');
          }
        }
      }

      console.log('📥 Loading next player...');
      await loadNextPlayer(latestAuction);
      console.log('✅ Next player loaded successfully');
      
    } catch (error) {
      console.error('❌ Error in handlePlayerSold:', error);
    } finally {
      isProcessingSaleRef.current = false;
    }
  };

  const handlePause = async () => {
    if (!auctionState || currentUser?.role !== 'admin') return;

    await supabase
      .from('auctions')
      .update({ is_paused: !auctionState.is_paused })
      .eq('auction_id', auctionState.auction_id);
  };

  const handleApplyFilters = async () => {
    if (!auctionState || currentUser?.role !== 'admin') return;
    if (!selectedClass || !selectedRole) {
      alert('Please select both Class and Role');
      return;
    }

    await supabase
      .from('auctions')
      .update({
        class_filter: selectedClass,
        role_filter: selectedRole,
      })
      .eq('auction_id', auctionState.auction_id);

    const updatedAuction = { ...auctionState, class_filter: selectedClass, role_filter: selectedRole };
    await loadNextPlayer(updatedAuction);
  };

  const getTimerColor = () => {
    if (!auctionState) return '#666';
    const timer = auctionState.timer_seconds;
    if (timer > 20) return '#2e7d32';
    if (timer > 10) return '#f57c00';
    return '#d32f2f';
  };

  // Calculate role counts
  const getRoleCounts = (): RoleCounts => {
    const counts: RoleCounts = {
      'Batsman': 0,
      'Bowler': 0,
      'All-rounder': 0,
      'Wicket Keeper': 0,
    };

    myTeam.forEach(player => {
      if (player.role in counts) {
        counts[player.role as keyof RoleCounts]++;
      }
    });

    return counts;
  };

  // Calculate missing roles to meet minimum requirements
  const getMissingRoles = (): RoleCounts => {
    const current = getRoleCounts();
    const minimums = {
      'Batsman': 3,
      'Bowler': 3,
      'All-rounder': 2,
      'Wicket Keeper': 1,
    };

    return {
      'Batsman': Math.max(0, minimums.Batsman - current.Batsman),
      'Bowler': Math.max(0, minimums.Bowler - current.Bowler),
      'All-rounder': Math.max(0, minimums['All-rounder'] - current['All-rounder']),
      'Wicket Keeper': Math.max(0, minimums['Wicket Keeper'] - current['Wicket Keeper']),
    };
  };

  // Check if manager can afford minimum requirements
  const checkBudgetFreeze = async () => {
    if (!currentUser || !auctionState) return;

    const missing = getMissingRoles();
    const totalMissing = missing.Batsman + missing.Bowler + missing['All-rounder'] + missing['Wicket Keeper'];

    // If already meeting minimums, not frozen
    if (totalMissing === 0) {
      setIsFrozen(false);
      setFreezeMessage('');
      return;
    }

    try {
      // Get all sold player IDs
      const { data: soldPlayers } = await supabase
        .from('team_players')
        .select('player_id');

      const soldPlayerIds = soldPlayers?.map(p => p.player_id) || [];

      // Get unsold player IDs
      const { data: unsoldPlayers } = await supabase
        .from('unsold_players')
        .select('player_id')
        .eq('auction_id', auctionState.auction_id);

      const unsoldPlayerIds = unsoldPlayers?.map(p => p.player_id) || [];

      // Combine - exclude BOTH sold AND unsold
      const excludedPlayerIds = [...soldPlayerIds, ...unsoldPlayerIds];

      // Calculate minimum cost for each role
      let totalMinCost = 0;
      const roleDetails: string[] = [];

      for (const [role, needed] of Object.entries(missing)) {
        if (needed === 0) continue;

        // Query cheapest available player for this role
        let query = supabase
          .from('players')
          .select('base_price')
          .eq('role', role)
          .order('base_price', { ascending: true })
          .limit(needed);

        if (excludedPlayerIds.length > 0) {
          query = query.not('player_id', 'in', `(${excludedPlayerIds.join(',')})`);
        }

        const { data: cheapestPlayers } = await query;

        if (cheapestPlayers && cheapestPlayers.length > 0) {
          const costForRole = cheapestPlayers.reduce((sum, p) => sum + p.base_price, 0);
          totalMinCost += costForRole;
          roleDetails.push(`${needed} ${role}(s): ${costForRole} pts`);
        } else {
          // No players available for this role - CRITICAL!
          setIsFrozen(true);
          setFreezeMessage(`⚠️ No ${role}s available to meet minimum requirements!`);
          return;
        }
      }

      // Check if budget is sufficient
      if (currentUser.current_budget < totalMinCost) {
        setIsFrozen(true);
        setFreezeMessage(`⚠️ Insufficient funds! Need ${totalMinCost} pts minimum (${roleDetails.join(', ')})`);
      } else {
        setIsFrozen(false);
        setFreezeMessage('');
      }
    } catch (error) {
      console.error('Error checking budget freeze:', error);
    }
  };

  // Check budget freeze whenever team or budget changes
  useEffect(() => {
    if (currentUser && myTeam) {
      checkBudgetFreeze();
    }
  }, [myTeam.length, currentUser?.current_budget]);

  const getRequirementStatus = (current: number, minimum: number) => {
    if (current >= minimum) return { icon: '✓', color: '#2e7d32' }; // Green
    if (current > 0) return { icon: '⚠️', color: '#f57c00' }; // Orange
    return { icon: '❌', color: '#d32f2f' }; // Red
  };

  if (loading || !auctionState) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: '#F8F8FC'
      }}>
        <p>Loading auction...</p>
      </div>
    );
  }

  if (!currentPlayer) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: '#F8F8FC'
      }}>
        <p>Loading player...</p>
      </div>
    );
  }

  const nextBidAmount = getNextBidAmount();
  const teamComplete = myTeam.length >= 15;
  const canBid = currentUser && 
                 currentUser.starting_budget > 0 && 
                 currentUser.current_budget >= nextBidAmount && 
                 !teamComplete && 
                 !isFrozen;
  const roleCounts = getRoleCounts();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
      padding: '15px',
      display: 'flex',
      gap: '15px',
    }}>
      {/* Main Auction Area */}
      <div style={{ flex: 1 }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(2, 8, 75, 0.2)',
        }}>
          {/* Timer */}
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <div style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: getTimerColor(),
              fontFamily: 'monospace',
            }}>
              {auctionState.timer_seconds}
            </div>
            <p style={{ color: '#666', fontSize: '12px' }}>seconds remaining</p>
          </div>

          {/* Current Player */}
          <div style={{
            background: '#f8f9fa',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '15px',
          }}>
            <h2 style={{
              fontSize: '24px',
              color: '#02084b',
              marginBottom: '10px',
              textAlign: 'center',
            }}>
              {currentPlayer.player_name}
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              fontSize: '12px',
            }}>
              <div>
                <p style={{ color: '#666', fontSize: '10px' }}>Country</p>
                <p style={{ color: '#02084b', fontWeight: 'bold', fontSize: '12px' }}>{currentPlayer.country}</p>
              </div>
              <div>
                <p style={{ color: '#666', fontSize: '10px' }}>Role</p>
                <p style={{ color: '#02084b', fontWeight: 'bold', fontSize: '12px' }}>{currentPlayer.role}</p>
              </div>
              <div>
                <p style={{ color: '#666', fontSize: '10px' }}>Class</p>
                <p style={{ color: '#02084b', fontWeight: 'bold', fontSize: '12px' }}>{currentPlayer.class_band}</p>
              </div>
              <div>
                <p style={{ color: '#666', fontSize: '10px' }}>Base Price</p>
                <p style={{ color: '#02084b', fontWeight: 'bold', fontSize: '12px' }}>{currentPlayer.base_price} pts</p>
              </div>
              {currentPlayer.role_detail && (
                <div>
                  <p style={{ color: '#666', fontSize: '10px' }}>Specialty</p>
                  <p style={{ color: '#02084b', fontWeight: 'bold', fontSize: '12px' }}>{currentPlayer.role_detail}</p>
                </div>
              )}
              {currentPlayer.ipl_team && (
                <div>
                  <p style={{ color: '#666', fontSize: '10px' }}>IPL Team</p>
                  <p style={{ color: '#02084b', fontWeight: 'bold', fontSize: '12px' }}>{currentPlayer.ipl_team}</p>
                </div>
              )}
            </div>
          </div>

          {/* Current Bid */}
          <div style={{
            background: currentBidder ? '#e3f2fd' : '#fff3cd',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '15px',
            textAlign: 'center',
          }}>
            {currentBidder && auctionState.current_bid_amount > 0 ? (
              <>
                <p style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Current Highest Bid</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#02084b', marginBottom: '5px' }}>
                  {auctionState.current_bid_amount} points
                </p>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  by <strong>{currentBidder.team_name || currentBidder.manager_name}</strong>
                </p>
              </>
            ) : (
              <>
                <p style={{ color: '#856404', fontSize: '16px', fontWeight: 'bold' }}>No bids yet!</p>
                <p style={{ color: '#856404', fontSize: '12px' }}>Starting: {currentPlayer.base_price} points</p>
              </>
            )}
          </div>

          {/* Team Complete Message */}
          {teamComplete && (
            <div style={{
              background: '#4caf50',
              color: 'white',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '15px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                🎉 Team Complete - Viewing Only
              </p>
              <p style={{ fontSize: '12px', marginTop: '5px', margin: 0 }}>
                You have reached the maximum of 15 players
              </p>
            </div>
          )}

          {/* Budget Frozen Message */}
          {!teamComplete && isFrozen && freezeMessage && (
            <div style={{
              background: '#ff9800',
              color: 'white',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '15px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                ⚠️ Bidding Frozen
              </p>
              <p style={{ fontSize: '12px', marginTop: '5px', margin: 0 }}>
                {freezeMessage}
              </p>
            </div>
          )}

          {/* Bid Button */}
          {canBid && (
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <button
                onClick={handleBid}
                disabled={auctionState.is_paused}
                style={{
                  padding: '15px 40px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  background: auctionState.is_paused ? '#ccc' : '#02084b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: auctionState.is_paused ? 'not-allowed' : 'pointer',
                }}
              >
                🎯 BID {nextBidAmount} POINTS
              </button>
              <p style={{ color: '#666', fontSize: '12px', marginTop: '5px' }}>
                Budget: {currentUser.current_budget} pts
              </p>
            </div>
          )}

          {/* Frozen Bid Button (disabled) */}
          {!teamComplete && isFrozen && (
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <button
                disabled
                style={{
                  padding: '15px 40px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  background: '#ccc',
                  color: '#666',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'not-allowed',
                }}
              >
                🚫 BIDDING FROZEN
              </button>
              <p style={{ color: '#ff9800', fontSize: '12px', marginTop: '5px', fontWeight: 'bold' }}>
                Cannot afford minimum requirements
              </p>
            </div>
          )}

          {/* Admin Controls */}
          {currentUser?.role === 'admin' && (
            <>
              <div style={{ textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '15px' }}>
                <button
                  onClick={handlePause}
                  style={{
                    padding: '8px 20px',
                    fontSize: '14px',
                    background: 'white',
                    color: '#02084b',
                    border: '2px solid #02084b',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  {auctionState.is_paused ? '▶️ RESUME' : '⏸️ PAUSE'}
                </button>
                <button
                  onClick={() => handlePlayerSold()}
                  style={{
                    padding: '8px 20px',
                    fontSize: '14px',
                    background: '#f57c00',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  ⏭️ SKIP
                </button>
              </div>

              <div style={{
                background: '#f8f9fa',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '10px',
              }}>
                <p style={{ fontSize: '11px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>
                  🎛️ Manual Filter Override
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    style={{
                      padding: '8px',
                      fontSize: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select Class</option>
                    <option value="Platinum">Platinum</option>
                    <option value="Gold">Gold</option>
                    <option value="Silver">Silver</option>
                    <option value="Copper">Copper</option>
                    <option value="Bronze">Bronze</option>
                    <option value="Stone">Stone</option>
                  </select>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    style={{
                      padding: '8px',
                      fontSize: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select Role</option>
                    <option value="Batsman">Batsman</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All-rounder">All-rounder</option>
                    <option value="Wicket Keeper">Wicket Keeper</option>
                  </select>
                </div>
                <button
                  onClick={handleApplyFilters}
                  disabled={!selectedClass || !selectedRole}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: (!selectedClass || !selectedRole) ? '#ccc' : '#02084b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (!selectedClass || !selectedRole) ? 'not-allowed' : 'pointer',
                  }}
                >
                  Apply Filters
                </button>
                <p style={{ fontSize: '10px', color: '#666', marginTop: '5px', fontStyle: 'italic' }}>
                  Auto-progression resumes after current category completes
                </p>
              </div>
            </>
          )}

          {/* Footer */}
          <div style={{
            textAlign: 'center',
            paddingTop: '12px',
            borderTop: '1px solid #eee',
            color: '#999',
            fontSize: '11px',
            marginTop: '10px',
          }}>
            Powered by <strong style={{ color: '#02084b' }}>NB Blue Studios</strong>
          </div>
        </div>
      </div>

      {/* Sidebar - My Team */}
      <div style={{ width: '420px' }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(2, 8, 75, 0.2)',
        }}>
          <h3 style={{ color: '#02084b', marginBottom: '10px', fontSize: '20px' }}>
            {currentUser?.team_name || currentUser?.manager_name}
          </h3>

          {/* Logout Button */}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              marginBottom: '15px',
              width: '100%',
            }}
          >
            🚪 Logout
          </button>

          {/* Budget and Players - Side by Side */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
            marginBottom: '12px',
          }}>
            <div style={{
              background: isFrozen ? '#ffe0b2' : '#f8f9fa',
              padding: '12px',
              borderRadius: '8px',
              border: isFrozen ? '2px solid #ff9800' : 'none',
            }}>
              <p style={{ color: '#666', fontSize: '11px', marginBottom: '3px' }}>Budget</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: isFrozen ? '#ff9800' : '#02084b' }}>
                {currentUser?.current_budget} / {currentUser?.starting_budget}
              </p>
              {isFrozen && (
                <p style={{ color: '#ff9800', fontSize: '9px', margin: 0, marginTop: '3px' }}>
                  ⚠️ Frozen
                </p>
              )}
            </div>
            <div style={{
              background: '#f8f9fa',
              padding: '12px',
              borderRadius: '8px',
            }}>
              <p style={{ color: '#666', fontSize: '11px', marginBottom: '3px' }}>Players</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#02084b' }}>
                {myTeam.length} / 15
              </p>
            </div>
          </div>

          {/* Role Requirements */}
          <div style={{
            background: '#f8f9fa',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '12px',
          }}>
            <p style={{ color: '#666', fontSize: '11px', marginBottom: '8px', fontWeight: '600' }}>
              📊 Team Requirements:
            </p>
            {(() => {
              const batsmanStatus = getRequirementStatus(roleCounts.Batsman, 3);
              const bowlerStatus = getRequirementStatus(roleCounts.Bowler, 3);
              const allrounderStatus = getRequirementStatus(roleCounts['All-rounder'], 2);
              const wkStatus = getRequirementStatus(roleCounts['Wicket Keeper'], 1);
              
              return (
                <>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', 
                    gap: '6px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ fontSize: '11px' }}>
                      <span style={{ color: batsmanStatus.color, marginRight: '5px' }}>{batsmanStatus.icon}</span>
                      <span style={{ color: '#02084b' }}>Batsmen: {roleCounts.Batsman}/3</span>
                    </div>
                    <div style={{ fontSize: '11px' }}>
                      <span style={{ color: bowlerStatus.color, marginRight: '5px' }}>{bowlerStatus.icon}</span>
                      <span style={{ color: '#02084b' }}>Bowlers: {roleCounts.Bowler}/3</span>
                    </div>
                    <div style={{ fontSize: '11px' }}>
                      <span style={{ color: allrounderStatus.color, marginRight: '5px' }}>{allrounderStatus.icon}</span>
                      <span style={{ color: '#02084b' }}>All-rounders: {roleCounts['All-rounder']}/2</span>
                    </div>
                    <div style={{ fontSize: '11px' }}>
                      <span style={{ color: wkStatus.color, marginRight: '5px' }}>{wkStatus.icon}</span>
                      <span style={{ color: '#02084b' }}>WK: {roleCounts['Wicket Keeper']}/1</span>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #ddd', paddingTop: '8px', fontSize: '11px', fontWeight: '600' }}>
                    Total: {myTeam.length}/11 min
                  </div>
                </>
              );
            })()}
          </div>

          {/* Squad List */}
          <div>
            <h4 style={{ color: '#02084b', marginBottom: '10px', fontSize: '16px' }}>
              Squad ({myTeam.length})
            </h4>
            {myTeam.length === 0 ? (
              <p style={{ color: '#666', fontSize: '12px', textAlign: 'center' }}>
                No players yet. Start bidding!
              </p>
            ) : (
              <div style={{ 
                maxHeight: '280px', 
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '6px',
              }}>
                {myTeam.map((player) => (
                  <div
                    key={player.player_id}
                    style={{
                      padding: '8px',
                      background: '#fff',
                      borderRadius: '6px',
                      border: '1px solid #ddd',
                    }}
                  >
                    <p style={{ color: '#02084b', fontSize: '11px', margin: 0 }}>
                      {player.player_name} ({player.price}pts)
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer in Sidebar */}
          <div style={{
            textAlign: 'center',
            paddingTop: '15px',
            marginTop: '15px',
            borderTop: '1px solid #eee',
            color: '#999',
            fontSize: '11px',
          }}>
            Powered by <strong style={{ color: '#02084b' }}>NB Blue Studios</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
