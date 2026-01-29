'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

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
  bid_freeze_until?: string | null;
  freeze_message?: string | null;
  is_bid_locked?: boolean;
}

interface RoleCounts {
  Batsman: number;
  Bowler: number;
  'All-rounder': number;
  'Wicket Keeper': number;
}

function AuctionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auctionIdParam = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Manager | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [currentBidder, setCurrentBidder] = useState<Manager | null>(null);
  const [myTeam, setMyTeam] = useState<TeamPlayer[]>([]);
  const [isFrozen, setIsFrozen] = useState(false);
  const [freezeMessage, setFreezeMessage] = useState('');
  const [round1Complete, setRound1Complete] = useState(false);
  
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const shouldSellRef = useRef(false);
  const isProcessingSaleRef = useRef(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (auctionState) {
      setSelectedClass(auctionState.class_filter || '');
      setSelectedRole(auctionState.role_filter || '');
    }
  }, [auctionState?.class_filter, auctionState?.role_filter]);

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
        
        if (payload.new) {
          const newAuction = payload.new as AuctionState;
          setAuctionState({...newAuction});
          
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
          
          if (newAuction.current_player_id) {
            supabase
              .from('players')
              .select('*')
              .eq('player_id', newAuction.current_player_id)
              .single()
              .then(({ data }) => {
                if (data) setCurrentPlayer(data);
              });
          } else {
            setCurrentPlayer(null);
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
        
        const { data: finalCheck } = await supabase
          .from('auctions')
          .select('is_bid_locked, timer_seconds')
          .eq('auction_id', auctionState.auction_id)
          .single();
        
        if (finalCheck && (finalCheck.is_bid_locked || finalCheck.timer_seconds > 5)) {
          console.log('⚠️ Bid detected at last second - not selling!');
          return;
        }
        
        await supabase
          .from('auctions')
          .update({ timer_seconds: 0 })
          .eq('auction_id', auctionState.auction_id);
        
        console.log('🔔 Calling handlePlayerSold directly...');
        await handlePlayerSold();
      } else {
        await supabase
          .from('auctions')
          .update({ timer_seconds: newTime })
          .eq('auction_id', auctionState.auction_id);
      }
    }, 1000);

    return () => {
      console.log('🧹 Cleaning up timer interval for player:', currentPlayer.player_name);
      clearInterval(interval);
    };
  }, [auctionState?.auction_id, auctionState?.is_paused, currentPlayer?.player_id, currentUser?.role]);

  useEffect(() => {
    if (shouldSellRef.current && auctionState && currentPlayer) {
      console.log('🔔 Executing player sale from ref...');
      shouldSellRef.current = false;
      handlePlayerSold();
    }
  }, [shouldSellRef.current]);

  const loadAuctionState = async () => {
    let auction = null;

    if (auctionIdParam) {
      const auctionId = parseInt(auctionIdParam);
      console.log('📥 Loading specific auction:', auctionId);

      const { data: specificAuction } = await supabase
        .from('auctions')
        .select('*')
        .eq('auction_id', auctionId)
        .single();

      if (!specificAuction) {
        alert(`Auction #${auctionId} not found!`);
        router.push('/history');
        return;
      }

      auction = specificAuction;
    } else {
      console.log('📥 Loading most recent active auction');

      const { data: activeAuction } = await supabase
        .from('auctions')
        .select('*')
        .in('status', ['active', 'round1', 'round2', 'completed'])
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .single();

      if (!activeAuction) {
        alert('No active auction found!');
        router.push('/lobby');
        return;
      }

      auction = activeAuction;
    }

    setAuctionState(auction);

    // Check if Round 1 is complete
    if (auction.status === 'completed') {
      setRound1Complete(true);
      setLoading(false);
      return auction;
    }

    if (auction.current_player_id) {
      const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('player_id', auction.current_player_id)
        .single();

      setCurrentPlayer(player);
    } else {
      if (auction.tournament_filter || auction.status === 'round2') {
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
    
    return auction;
  };

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
    const auction = await loadAuctionState();
    if (auction) {
      loadMyTeam(mgr.manager_id, auction);
    }
    setLoading(false);
  };

  const loadNextPlayer = async (auction: AuctionState) => {
    try {
      console.log('📥 Loading next player...');
      console.log('🔍 Auction status:', auction.status);
      
      const { data: soldPlayers } = await supabase
        .from('team_players')
        .select('player_id')
        .eq('auction_id', auction.auction_id);

      const soldPlayerIds = soldPlayers?.map(p => p.player_id) || [];
      console.log('✅ Sold players:', soldPlayerIds.length);

      let availablePlayers: Player[] = [];

      if (auction.status === 'round2') {
        console.log('🎯 Loading Round 2 players from selections...');

        const { data: round2Selections } = await supabase
          .from('round2_selections')
          .select('player_id')
          .eq('auction_id', auction.auction_id);

        if (!round2Selections || round2Selections.length === 0) {
          console.log('🎉 Round 2 Complete!');
          setCurrentPlayer(null);
          return;
        }

        const selectedPlayerIds = round2Selections.map(s => s.player_id);
        console.log('📋 Total Round 2 selections:', selectedPlayerIds.length);

        const unsoldSelectedIds = selectedPlayerIds.filter(id => !soldPlayerIds.includes(id));
        console.log('📊 Unsold Round 2 players:', unsoldSelectedIds.length);

        if (unsoldSelectedIds.length === 0) {
          console.log('🎉 Round 2 Complete!');
          setCurrentPlayer(null);
          return;
        }

        const { data: players } = await supabase
          .from('players')
          .select('*')
          .in('player_id', unsoldSelectedIds);

        availablePlayers = players || [];

      } else {
        console.log('🔍 Round 1 - Current filters:', auction.class_filter, auction.role_filter);

        const { data: unsoldPlayers } = await supabase
          .from('unsold_players')
          .select('player_id')
          .eq('auction_id', auction.auction_id);

        const unsoldPlayerIds = unsoldPlayers?.map(p => p.player_id) || [];
        const excludedPlayerIds = [...soldPlayerIds, ...unsoldPlayerIds];

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

        const { data: players } = await queryBuilder;
        availablePlayers = players || [];
      }

      console.log('📊 Available players:', availablePlayers.length);

      if (availablePlayers.length > 0) {
        const randomIndex = Math.floor(Math.random() * availablePlayers.length);
        const newPlayer = availablePlayers[randomIndex];

        console.log('✅ Selected player:', newPlayer.player_name);

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

      if (auction.status === 'round2') {
        console.log('🎉 Round 2 Complete!');
        setCurrentPlayer(null);
        return;
      }

      console.log('No players in current category, auto-progressing...');
      
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
      ];

      const currentIndex = categories.findIndex(
        cat => cat.class === auction.class_filter && cat.role === auction.role_filter
      );

      if (currentIndex >= 0 && currentIndex < categories.length - 1) {
        const nextCategory = categories[currentIndex + 1];
        
        console.log(`Moving from ${auction.class_filter} ${auction.role_filter} to ${nextCategory.class} ${nextCategory.role}`);
        
        await supabase
          .from('auctions')
          .update({
            class_filter: nextCategory.class,
            role_filter: nextCategory.role,
          })
          .eq('auction_id', auction.auction_id);

        const updatedAuction = { ...auction, class_filter: nextCategory.class, role_filter: nextCategory.role };
        await loadNextPlayer(updatedAuction);
        
      } else {
        console.log('🎉 Round 1 Complete! All categories finished!');
        
        // Update auction status to 'completed'
        await supabase
          .from('auctions')
          .update({ 
            status: 'completed',
            current_player_id: null,
            current_bid_amount: 0,
            current_bid_manager_id: null,
            is_paused: true,
          })
          .eq('auction_id', auction.auction_id);
        
        setRound1Complete(true);
        setCurrentPlayer(null);
      }

    } catch (error) {
      console.error('Error loading player:', error);
    }
  };

  const loadMyTeam = async (managerId: number, auction?: AuctionState) => {
    const auctionToUse = auction || auctionState;
    if (!auctionToUse) return;
    
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('team_players')
        .select('player_id, price')
        .eq('manager_id', managerId)
        .eq('auction_id', auctionToUse.auction_id);

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

    if (myTeam.length >= 15) {
      alert('You have reached the maximum of 15 players!');
      return;
    }

    const nextBidAmount = getNextBidAmount();
    
    if (currentUser.current_budget < nextBidAmount) {
      alert('Insufficient budget!');
      return;
    }

    const budgetAfterBid = currentUser.current_budget - nextBidAmount;
    const playersAfterBid = myTeam.length + 1;
    const playersStillNeeded = Math.max(0, 11 - playersAfterBid);
    
    if (playersStillNeeded > 0) {
      const missing = getMissingRoles();
      
      let totalMinimumCost = 0;
      const missingCount = missing.Batsman + missing.Bowler + missing['All-rounder'] + missing['Wicket Keeper'];
      
      const playersToCalculate = Math.max(missingCount, playersStillNeeded);
      
      totalMinimumCost = playersToCalculate * 60;
      
      if (budgetAfterBid < totalMinimumCost) {
        alert(
          `⚠️ CANNOT BID!\n\n` +
          `After this ${nextBidAmount} pts bid, you'll have ${budgetAfterBid} pts left.\n\n` +
          `You still need ${playersStillNeeded} more players (minimum ${totalMinimumCost} pts).\n\n` +
          `This bid would eliminate you from the game!`
        );
        return;
      }
    }

    console.log('💰 Attempting bid:', nextBidAmount, 'for', currentPlayer.player_name);

    const { data: currentAuction } = await supabase
      .from('auctions')
      .select('is_bid_locked, bid_freeze_until')
      .eq('auction_id', auctionState.auction_id)
      .single();

    if (currentAuction?.is_bid_locked) {
      alert('⏱️ Another bid in progress! Please wait...');
      return;
    }

    if (currentAuction?.bid_freeze_until) {
      const freezeEnd = new Date(currentAuction.bid_freeze_until).getTime();
      const now = Date.now();
      if (now < freezeEnd) {
        alert('⏱️ Bidding frozen! Please wait...');
        return;
      }
    }

    const { data: lockResult, error: lockError } = await supabase
      .from('auctions')
      .update({ is_bid_locked: true })
      .eq('auction_id', auctionState.auction_id)
      .eq('is_bid_locked', false)
      .select();

    if (lockError || !lockResult || lockResult.length === 0) {
      console.log('⚠️ Bid lock failed - someone else bid first');
      alert('⏱️ Another manager bid first! Try again...');
      return;
    }

    const freezeUntil = new Date(Date.now() + 3000);
    const message = `${currentUser.team_name || currentUser.manager_name} bid ${nextBidAmount} pts!`;

    await supabase
      .from('auctions')
      .update({
        current_bid_amount: nextBidAmount,
        current_bid_manager_id: currentUser.manager_id,
        timer_seconds: 30,
        bid_freeze_until: freezeUntil.toISOString(),
        freeze_message: message,
      })
      .eq('auction_id', auctionState.auction_id);

    await supabase.from('bids').insert({
      auction_id: auctionState.auction_id,
      manager_id: currentUser.manager_id,
      player_id: currentPlayer.player_id,
      bid_amount: nextBidAmount,
    });

    console.log('✅ Bid placed successfully');

    const { data: updatedUser } = await supabase
      .from('managers')
      .select('*')
      .eq('manager_id', currentUser.manager_id)
      .single();
    
    if (updatedUser) {
      setCurrentUser(updatedUser);
    }

    setTimeout(async () => {
      await supabase
        .from('auctions')
        .update({
          is_bid_locked: false,
          bid_freeze_until: null,
          freeze_message: null,
        })
        .eq('auction_id', auctionState.auction_id);
    }, 3000);
  };

  const getNextBidAmount = () => {
    if (!auctionState || auctionState.current_bid_amount === 0) {
      if (auctionState?.status === 'round2') {
        return 5;
      }
      return currentPlayer?.base_price || 5;
    }

    const current = auctionState.current_bid_amount;
    if (current < 100) return current + 5;
    if (current < 200) return current + 10;
    return current + 20;
  };

  const handlePlayerSold = async () => {
    console.log('🔔 handlePlayerSold called');
    
    if (isProcessingSaleRef.current) {
      console.log('⚠️ Already processing a sale, skipping...');
      return;
    }
    
    isProcessingSaleRef.current = true;
    
    try {
      const { data: latestAuction } = await supabase
        .from('auctions')
        .select('*')
        .eq('auction_id', auctionState!.auction_id)
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

      let manager = null;
      const currentRound = latestAuction.status === 'round2' ? 2 : 1;

      if (latestAuction.current_bid_manager_id && latestAuction.current_bid_amount > 0) {
        console.log('💰 Selling player to:', latestAuction.current_bid_manager_id, 'for', latestAuction.current_bid_amount);
        
        const { error: insertError } = await supabase.from('team_players').insert({
          auction_id: latestAuction.auction_id,
          manager_id: latestAuction.current_bid_manager_id,
          player_id: latestPlayer.player_id,
          price: latestAuction.current_bid_amount,
          round: currentRound,
        });

        if (insertError) {
          console.error('❌ Error inserting team_players:', insertError);
        } else {
          console.log('✅ Player added to team_players (Round', currentRound, ')');
        }

        const { data: managerData } = await supabase
          .from('managers')
          .select('*')
          .eq('manager_id', latestAuction.current_bid_manager_id)
          .single();

        manager = managerData;

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
        console.log('⏭️ No bids - player UNSOLD');
        
        if (latestAuction.status !== 'round2') {
          const { data: existingUnsold } = await supabase
            .from('unsold_players')
            .select('unsold_id')
            .eq('auction_id', latestAuction.auction_id)
            .eq('player_id', latestPlayer.player_id)
            .maybeSingle();

          if (!existingUnsold) {
            await supabase.from('unsold_players').insert({
              auction_id: latestAuction.auction_id,
              player_id: latestPlayer.player_id,
            });
            console.log('✅ Player marked as unsold');
          }
        }
      }

      const soldMsg = latestAuction.current_bid_manager_id && latestAuction.current_bid_amount > 0
        ? `🎉 SOLD to ${manager?.team_name || manager?.manager_name || 'Manager'} for ${latestAuction.current_bid_amount} pts!`
        : '⏭️ UNSOLD - Moving to next player...';

      await supabase
        .from('auctions')
        .update({
          freeze_message: soldMsg,
          is_bid_locked: true,
          bid_freeze_until: new Date(Date.now() + 5000).toISOString(),
        })
        .eq('auction_id', latestAuction.auction_id);

      console.log('💬 Showing sold message for 5 seconds...');

      setTimeout(async () => {
        console.log('📥 Loading next player...');
        
        await supabase
          .from('auctions')
          .update({
            freeze_message: null,
            is_bid_locked: false,
            bid_freeze_until: null,
          })
          .eq('auction_id', latestAuction.auction_id);
        
        await loadNextPlayer(latestAuction);
        console.log('✅ Next player loaded successfully');
      }, 5000);
      
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

  const handleGoToRound2Setup = () => {
    router.push('/admin/round2');
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

  const checkBudgetFreeze = async () => {
    if (!currentUser || !auctionState) return;

    const missing = getMissingRoles();
    const totalMissing = missing.Batsman + missing.Bowler + missing['All-rounder'] + missing['Wicket Keeper'];

    if (totalMissing === 0) {
      setIsFrozen(false);
      setFreezeMessage('');
      return;
    }

    try {
      const { data: soldPlayers } = await supabase
        .from('team_players')
        .select('player_id')
        .eq('auction_id', auctionState.auction_id);

      const soldPlayerIds = soldPlayers?.map(p => p.player_id) || [];

      const { data: unsoldPlayers } = await supabase
        .from('unsold_players')
        .select('player_id')
        .eq('auction_id', auctionState.auction_id);

      const unsoldPlayerIds = unsoldPlayers?.map(p => p.player_id) || [];
      const excludedPlayerIds = [...soldPlayerIds, ...unsoldPlayerIds];

      let totalMinCost = 0;
      let someRoleUnavailable = false;

      for (const [role, needed] of Object.entries(missing)) {
        if (needed === 0) continue;

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

        if (!cheapestPlayers || cheapestPlayers.length === 0) {
          someRoleUnavailable = true;
          break;
        } else {
          const costForRole = cheapestPlayers.reduce((sum, p) => sum + p.base_price, 0);
          totalMinCost += costForRole;
        }
      }

      if (someRoleUnavailable || currentUser.current_budget < totalMinCost) {
        setIsFrozen(true);
        setFreezeMessage('Cannot meet minimum team requirements.\n\nWhat\'s Next: Wait for more players to be auctioned or for Round 2 to begin.');
      } else {
        setIsFrozen(false);
        setFreezeMessage('');
      }
    } catch (error) {
      console.error('Error checking budget freeze:', error);
    }
  };

  useEffect(() => {
    if (currentUser && myTeam) {
      checkBudgetFreeze();
    }
  }, [myTeam.length, currentUser?.current_budget]);

  const getRequirementStatus = (current: number, minimum: number) => {
    if (current >= minimum) return { icon: '✓', color: '#2e7d32' };
    if (current > 0) return { icon: '⚠️', color: '#f57c00' };
    return { icon: '❌', color: '#d32f2f' };
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

  // Round 1 Complete - Admin View
  if (round1Complete && currentUser?.role === 'admin') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
      }}>
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '16px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎉</div>
          <h1 style={{ color: '#02084b', fontSize: '32px', marginBottom: '15px' }}>
            Round 1 Complete!
          </h1>
          <p style={{ color: '#666', fontSize: '16px', marginBottom: '30px', lineHeight: '1.6' }}>
            All categories have been auctioned.<br/>
            Ready to set up Round 2?
          </p>
          <button
            onClick={handleGoToRound2Setup}
            style={{
              padding: '18px 50px',
              fontSize: '20px',
              fontWeight: 'bold',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(76, 175, 80, 0.4)',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🎯 GO TO ROUND 2 SETUP
          </button>
        </div>
      </div>
    );
  }

  // Round 1 Complete - Regular User View
  if (round1Complete && currentUser?.role !== 'admin') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
      }}>
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '16px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>⏳</div>
          <h1 style={{ color: '#02084b', fontSize: '32px', marginBottom: '15px' }}>
            Waiting for Round 2
          </h1>
          <p style={{ color: '#666', fontSize: '16px', lineHeight: '1.6' }}>
            Round 1 is complete!<br/>
            Admin is preparing Round 2...<br/><br/>
            Please wait...
          </p>
          <div style={{ marginTop: '30px' }}>
            <div className="spinner" style={{
              width: '50px',
              height: '50px',
              border: '5px solid #f3f3f3',
              borderTop: '5px solid #02084b',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
            }}></div>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // No player available (waiting to load)
  if (!currentPlayer) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)'
      }}>
        <p style={{ color: 'white', fontSize: '18px' }}>Loading player...</p>
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

  const displayBasePrice = auctionState.status === 'round2' ? 0 : currentPlayer.base_price;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
      padding: '15px',
      display: 'flex',
      gap: '15px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(2, 8, 75, 0.2)',
        }}>
          {auctionState.status === 'round2' && (
            <div style={{
              background: '#ff9800',
              color: 'white',
              padding: '10px',
              borderRadius: '8px',
              textAlign: 'center',
              marginBottom: '15px',
              fontWeight: 'bold',
            }}>
              🔥 ROUND 2 AUCTION - Base Price: 0 pts
            </div>
          )}

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
                <p style={{ color: '#02084b', fontWeight: 'bold', fontSize: '12px' }}>{displayBasePrice} pts</p>
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

          {auctionState.freeze_message && (
            <div style={{
              background: auctionState.freeze_message.includes('SOLD') || auctionState.freeze_message.includes('🎉') 
                ? '#4caf50' 
                : '#2196f3',
              color: 'white',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '15px',
              textAlign: 'center',
              fontSize: '18px',
              fontWeight: 'bold',
            }}>
              {auctionState.freeze_message}
            </div>
          )}

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
                <p style={{ color: '#856404', fontSize: '12px' }}>Starting: {displayBasePrice} points</p>
              </>
            )}
          </div>

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
                ⚠️ Bidding Paused
              </p>
              <p style={{ fontSize: '13px', marginTop: '8px', margin: 0, whiteSpace: 'pre-line' }}>
                {freezeMessage}
              </p>
            </div>
          )}

          {canBid && (
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <button
                onClick={handleBid}
                disabled={auctionState.is_paused || auctionState.is_bid_locked}
                style={{
                  padding: '15px 40px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  background: (auctionState.is_paused || auctionState.is_bid_locked) ? '#ccc' : '#02084b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (auctionState.is_paused || auctionState.is_bid_locked) ? 'not-allowed' : 'pointer',
                }}
              >
                {auctionState.is_bid_locked ? '⏱️ WAIT...' : `🎯 BID ${nextBidAmount} POINTS`}
              </button>
              <p style={{ color: '#666', fontSize: '12px', marginTop: '5px' }}>
                Budget: {currentUser.current_budget} pts
              </p>
            </div>
          )}

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

              {auctionState.status !== 'round2' && (
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
              )}
            </>
          )}

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

export default function AuctionPage() {
  return (
    <Suspense fallback={<div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: '#F8F8FC'
    }}>
      <p>Loading auction...</p>
    </div>}>
      <AuctionPageContent />
    </Suspense>
  );
}
