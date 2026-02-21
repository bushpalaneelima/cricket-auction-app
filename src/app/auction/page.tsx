'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuctionAccess } from '../lib/accessControl';

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

interface Participant {
  participant_id: number;
  manager_id: number;
  current_budget: number;
  starting_budget: number;
  managers: {
    manager_id: number;
    manager_name: string;
    email: string;
    role: string;
    team_name?: string;
  };
}

interface AuctionState {
  auction_id: number;
  current_player_id: number | null;
  current_bid_amount: number;
  current_bid_participant_id: number | null;
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
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [playersSold, setPlayersSold] = useState(0);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [access, setAccess] = useState<any>(null);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [currentBidder, setCurrentBidder] = useState<Participant | null>(null);
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
    if (!auctionState || !currentParticipant) return;

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
          
          if (newAuction.current_bid_participant_id) {
            supabase
              .from('auction_participants')
              .select(`
                participant_id,
                manager_id,
                current_budget,
                starting_budget,
                managers!inner (
                  manager_id,
                  manager_name,
                  email,
                  role,
                  team_name
                )
              `)
              .eq('participant_id', newAuction.current_bid_participant_id)
              .single()
              .then(({ data }) => {
                setCurrentBidder(data as any);
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
      }, () => {
        console.log('Player sold');
        if (currentParticipant) {
          refreshCurrentParticipant();
          loadMyTeam(currentParticipant.participant_id);
          if (auctionState) {
            loadPlayerStats(auctionState);
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'auction_participants',
        filter: `participant_id=eq.${currentParticipant.participant_id}`,
      }, () => {
        console.log('Participant updated');
        refreshCurrentParticipant();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auctionState?.auction_id, currentParticipant?.participant_id]);

  const refreshCurrentParticipant = async () => {
  if (!currentParticipant) return;
  
  try {
    const { data: updatedParticipant, error } = await supabase
      .from('auction_participants')
      .select('participant_id, manager_id, current_budget, starting_budget')
      .eq('participant_id', currentParticipant.participant_id)
      .single();
    
    if (error) {
      console.error('Error refreshing participant:', error);
      return;
    }
    
    if (updatedParticipant) {
      setCurrentParticipant({
        ...updatedParticipant,
        managers: currentParticipant.managers
      } as any);
    }
  } catch (err) {
    console.error('Exception:', err);
  }
};

useEffect(() => {
  if (!auctionState || !access?.canControl) return;
  if (auctionState.is_paused || !currentPlayer) return;

  console.log('⏰ Timer started for player:', currentPlayer.player_name);

  const interval = setInterval(async () => {
    const { data: currentAuction } = await supabase
      .from('auctions')
      .select('timer_seconds, is_paused')
      .eq('auction_id', auctionState.auction_id)
      .single();
    
      console.log('⏱️ Tick:', currentAuction?.timer_seconds); // ← ADD THIS

    if (!currentAuction) return;
    
    // Check if paused
    if (currentAuction.is_paused) {
      clearInterval(interval);
      return;
    }

    const newTime = currentAuction.timer_seconds - 1;

    if (newTime <= 0) {
      clearInterval(interval);
      
      const { data: finalCheck } = await supabase
        .from('auctions')
        .select('is_bid_locked, timer_seconds')
        .eq('auction_id', auctionState.auction_id)
        .single();
      
      if (finalCheck && (finalCheck.is_bid_locked || finalCheck.timer_seconds > 5)) {
        return;
      }
      
      await supabase
        .from('auctions')
        .update({ timer_seconds: 0 })
        .eq('auction_id', auctionState.auction_id);
      
      await handlePlayerSold();
    } else {
      await supabase
        .from('auctions')
        .update({ timer_seconds: newTime })
        .eq('auction_id', auctionState.auction_id);
    }
  }, 1000);

  return () => {
    console.log('⏰ Timer cleanup');
    clearInterval(interval);
  };
}, [auctionState?.auction_id, currentPlayer?.player_id]); // ✅ REMOVED is_paused and canControl

  const loadAuctionState = async () => {
    let auction = null;

    if (auctionIdParam) {
      const auctionId = parseInt(auctionIdParam);

      const { data: specificAuction } = await supabase
        .from('auctions')
        .select('*')
        .eq('auction_id', auctionId)
        .single();

      if (!specificAuction) {
        alert(`Auction #${auctionId} not found!`);
        router.push('/admin/history');
        return;
      }

      auction = specificAuction;
    } else {
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

    if (auction.status === 'completed') {
      setRound1Complete(true);
      setLoading(false);
      await loadPlayerStats(auction);
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

    if (auction.current_bid_participant_id) {
      const { data: bidder } = await supabase
        .from('auction_participants')
        .select(`
          participant_id,
          manager_id,
          current_budget,
          starting_budget,
          managers!inner (
            manager_id,
            manager_name,
            email,
            role,
            team_name
          )
        `)
        .eq('participant_id', auction.current_bid_participant_id)
        .single();

      setCurrentBidder(bidder as any);
    } else {
      setCurrentBidder(null);
    }
    
    await loadPlayerStats(auction);
    return auction;
  };

  const loadPlayerStats = async (auction: AuctionState) => {
    try {
      let totalCount = 0;
      
      if (auction.tournament_filter) {
        const { count } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq(auction.tournament_filter, true);
        
        totalCount = count || 0;
      } else {
        const { count } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true });
        
        totalCount = count || 0;
      }
      
      setTotalPlayers(totalCount);
      
      const { count: soldCount } = await supabase
        .from('team_players')
        .select('*', { count: 'exact', head: true })
        .eq('auction_id', auction.auction_id);
      
      setPlayersSold(soldCount || 0);
    } catch (error) {
      console.error('Error loading player stats:', error);
    }
  };

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    
    setCurrentUserEmail(session.user.email || null);
    
    const auction = await loadAuctionState();
    
    if (!auction) {
      setLoading(false);
      return;
    }

    const accessInfo = await getAuctionAccess(
      session.user.email || '',
      auction.auction_id
    );

    if (!accessInfo.canView) {
      alert('⚠️ You do not have access to this auction!');
      router.push('/home');
      return;
    }

    setAccess(accessInfo);

    if (accessInfo.isParticipant && accessInfo.participantId) {
      const { data: participant } = await supabase
        .from('auction_participants')
        .select(`
          participant_id,
          manager_id,
          current_budget,
          starting_budget,
          managers!inner (
            manager_id,
            manager_name,
            email,
            role,
            team_name
          )
        `)
        .eq('participant_id', accessInfo.participantId)
        .single();

      if (participant) {
        setCurrentParticipant(participant as any);
        loadMyTeam(accessInfo.participantId, auction);
      }
    }
    
    setLoading(false);
  };

  const loadNextPlayer = async (auction: AuctionState) => {
    try {
      const { data: soldPlayers } = await supabase
        .from('team_players')
        .select('player_id')
        .eq('auction_id', auction.auction_id);

      const soldPlayerIds = soldPlayers?.map(p => p.player_id) || [];

      let availablePlayers: Player[] = [];

      if (auction.status === 'round2') {
        const { data: round2Selections } = await supabase
          .from('round2_selections')
          .select('player_id')
          .eq('auction_id', auction.auction_id);

        if (!round2Selections || round2Selections.length === 0) {
          setCurrentPlayer(null);
          return;
        }

        const selectedPlayerIds = round2Selections.map(s => s.player_id);
        const unsoldSelectedIds = selectedPlayerIds.filter(id => !soldPlayerIds.includes(id));

        if (unsoldSelectedIds.length === 0) {
          setCurrentPlayer(null);
          return;
        }

        const { data: players } = await supabase
          .from('players')
          .select('*')
          .in('player_id', unsoldSelectedIds);

        availablePlayers = players || [];

      } else {
        const { data: unsoldPlayers } = await supabase
          .from('unsold_players')
          .select('player_id')
          .eq('auction_id', auction.auction_id);

        const unsoldPlayerIds = unsoldPlayers?.map(p => p.player_id) || [];
        const excludedPlayerIds = [...soldPlayerIds, ...unsoldPlayerIds];

        let queryBuilder = supabase
          .from('players')
          .select('*');

        if (auction.tournament_filter) {
          queryBuilder = queryBuilder.eq(auction.tournament_filter, true);
        }

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

      if (availablePlayers.length > 0) {
        const randomIndex = Math.floor(Math.random() * availablePlayers.length);
        const newPlayer = availablePlayers[randomIndex];

        await supabase
          .from('auctions')
          .update({
            current_player_id: newPlayer.player_id,
            current_bid_amount: 0,
            current_bid_participant_id: null,
            timer_seconds: 30,
          })
          .eq('auction_id', auction.auction_id);

        setCurrentPlayer(newPlayer);
        return;
      }

      if (auction.status === 'round2') {
        setCurrentPlayer(null);
        return;
      }

      const categoryOrder = [
        { class_band: 'Platinum', role: 'Batsman' },
        { class_band: 'Platinum', role: 'Bowler' },
        { class_band: 'Platinum', role: 'All-rounder' },
        { class_band: 'Platinum', role: 'Wicket Keeper' },
        { class_band: 'Gold', role: 'Batsman' },
        { class_band: 'Gold', role: 'Bowler' },
        { class_band: 'Gold', role: 'All-rounder' },
        { class_band: 'Gold', role: 'Wicket Keeper' },
        { class_band: 'Silver', role: 'Batsman' },
        { class_band: 'Silver', role: 'Bowler' },
        { class_band: 'Silver', role: 'All-rounder' },
        { class_band: 'Silver', role: 'Wicket Keeper' },
      ];

      const currentIndex = categoryOrder.findIndex(
        (cat) => cat.class_band === auction.class_filter && cat.role === auction.role_filter
      );

      if (currentIndex === -1) {
        const first = categoryOrder[0];
        await supabase
          .from('auctions')
          .update({ class_filter: first.class_band, role_filter: first.role })
          .eq('auction_id', auction.auction_id);

        await loadNextPlayer({ ...auction, class_filter: first.class_band, role_filter: first.role });
        return;
      }

      if (currentIndex < categoryOrder.length - 1) {
        const nextCategory = categoryOrder[currentIndex + 1];
        await supabase
          .from('auctions')
          .update({
            class_filter: nextCategory.class_band,
            role_filter: nextCategory.role,
          })
          .eq('auction_id', auction.auction_id);

        await loadNextPlayer({
          ...auction,
          class_filter: nextCategory.class_band,
          role_filter: nextCategory.role,
        });
        return;
      }

      await supabase
        .from('auctions')
        .update({
          status: 'completed',
          current_player_id: null,
          current_bid_amount: 0,
          current_bid_participant_id: null,
          is_paused: true,
        })
        .eq('auction_id', auction.auction_id);

      setRound1Complete(true);
      setCurrentPlayer(null);

    } catch (error) {
      console.error('Error loading player:', error);
    }
  };

  const loadMyTeam = async (participantId: number, auction?: AuctionState) => {
    const auctionToUse = auction || auctionState;
    if (!auctionToUse) return;
    
    try {
      const { data: participant } = await supabase
        .from('auction_participants')
        .select('manager_id')
        .eq('participant_id', participantId)
        .single();

      if (!participant) return;

      const { data: teamData } = await supabase
        .from('team_players')
        .select('player_id, price')
        .eq('manager_id', participant.manager_id)
        .eq('auction_id', auctionToUse.auction_id);

      if (!teamData || teamData.length === 0) {
        setMyTeam([]);
        return;
      }

      const playerIds = teamData.map(item => item.player_id);
      
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .in('player_id', playerIds);

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
    if (!currentParticipant || !currentPlayer || !auctionState) return;

    if (myTeam.length >= 15) {
      alert('You have reached the maximum of 15 players!');
      return;
    }

    const nextBidAmount = getNextBidAmount();
    
    if (currentParticipant.current_budget < nextBidAmount) {
      alert('Insufficient budget!');
      return;
    }

    const budgetAfterBid = currentParticipant.current_budget - nextBidAmount;
    const playersAfterBid = myTeam.length + 1;
    const playersStillNeeded = Math.max(0, 11 - playersAfterBid);
    
    if (playersStillNeeded > 0) {
      const missing = getMissingRoles();
      
      const missingCount = missing.Batsman + missing.Bowler + missing['All-rounder'] + missing['Wicket Keeper'];
      
      const playersToCalculate = Math.max(missingCount, playersStillNeeded);
      const costPerPlayer = auctionState?.status === 'round2' ? 5 : 60;
      const totalMinimumCost = playersToCalculate * costPerPlayer;
      
      if (budgetAfterBid < totalMinimumCost) {
        alert(
          `⚠️ CANNOT BID!\n\n` +
          `After this ${nextBidAmount} pts bid, you'll have ${budgetAfterBid} pts left.\n\n` +
          `You still need ${playersStillNeeded} more players (minimum ${totalMinimumCost} pts).`
        );
        return;
      }
    }

    const { data: currentAuction } = await supabase
      .from('auctions')
      .select('is_bid_locked, bid_freeze_until')
      .eq('auction_id', auctionState.auction_id)
      .single();

    if (currentAuction?.is_bid_locked) {
      alert('⏱️ Another bid in progress!');
      return;
    }

    if (currentAuction?.bid_freeze_until) {
      const freezeEnd = new Date(currentAuction.bid_freeze_until).getTime();
      if (Date.now() < freezeEnd) {
        alert('⏱️ Bidding frozen!');
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
      alert('⏱️ Another manager bid first!');
      return;
    }

    const freezeUntil = new Date(Date.now() + 3000);
    const message = `${currentParticipant.managers.team_name || currentParticipant.managers.manager_name} bid ${nextBidAmount} pts!`;

    await supabase
      .from('auctions')
      .update({
        current_bid_amount: nextBidAmount,
        current_bid_participant_id: currentParticipant.participant_id,
        timer_seconds: 30,
        bid_freeze_until: freezeUntil.toISOString(),
        freeze_message: message,
      })
      .eq('auction_id', auctionState.auction_id);

    await supabase.from('bids').insert({
      auction_id: auctionState.auction_id,
      participant_id: currentParticipant.participant_id,
      manager_id: currentParticipant.manager_id,
      player_id: currentPlayer.player_id,
      bid_amount: nextBidAmount,
    });

    await refreshCurrentParticipant();

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
    if (isProcessingSaleRef.current) return;
    
    isProcessingSaleRef.current = true;
    
    try {
      const { data: latestAuction } = await supabase
        .from('auctions')
        .select('*')
        .eq('auction_id', auctionState!.auction_id)
        .single();

      if (!latestAuction) return;

      const { data: latestPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('player_id', latestAuction.current_player_id)
        .single();

      if (!latestPlayer) return;

      let participant = null;
      const currentRound = latestAuction.status === 'round2' ? 2 : 1;

      if (latestAuction.current_bid_participant_id && latestAuction.current_bid_amount > 0) {
        const { data: participantData } = await supabase
          .from('auction_participants')
          .select(`
            participant_id,
            manager_id,
            current_budget,
            managers!inner (
              manager_name,
              team_name
            )
          `)
          .eq('participant_id', latestAuction.current_bid_participant_id)
          .single();

        participant = participantData;

        if (participant) {
          await supabase.from('team_players').insert({
            auction_id: latestAuction.auction_id,
            manager_id: participant.manager_id,
            player_id: latestPlayer.player_id,
            price: latestAuction.current_bid_amount,
            round: currentRound,
          });

          const newBudget = participant.current_budget - latestAuction.current_bid_amount;
          
          await supabase
            .from('auction_participants')
            .update({ current_budget: newBudget })
            .eq('participant_id', latestAuction.current_bid_participant_id);
        }
      } else {
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
          }
        }
      }

        const soldMsg = latestAuction.current_bid_participant_id && latestAuction.current_bid_amount > 0
            ? `🎉 SOLD to ${(participant?.managers as any)?.team_name || (participant?.managers as any)?.manager_name || 'Manager'} for ${latestAuction.current_bid_amount} pts!`
            : '⏭️ UNSOLD - Moving to next player...';

      await supabase
        .from('auctions')
        .update({
          freeze_message: soldMsg,
          is_bid_locked: true,
          bid_freeze_until: new Date(Date.now() + 5000).toISOString(),
        })
        .eq('auction_id', latestAuction.auction_id);

      setTimeout(async () => {
        await supabase
          .from('auctions')
          .update({
            freeze_message: null,
            is_bid_locked: false,
            bid_freeze_until: null,
          })
          .eq('auction_id', latestAuction.auction_id);
        
        await loadNextPlayer(latestAuction);
      }, 5000);
      
    } catch (error) {
      console.error('Error in handlePlayerSold:', error);
    } finally {
      isProcessingSaleRef.current = false;
    }
  };

  const handlePause = async () => {
    if (!auctionState) return;
    if (!access?.canControl) return; // Only admins run the timer

    await supabase
      .from('auctions')
      .update({ is_paused: !auctionState.is_paused })
      .eq('auction_id', auctionState.auction_id);
  };

  const handleGoToRound2Setup = () => {
    router.push('/admin/round2');
  };

  const handleApplyFilters = async () => {
    if (!auctionState || !access?.canControl) return;
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
    if (!currentParticipant || !auctionState) return;

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

      if (someRoleUnavailable || currentParticipant.current_budget < totalMinCost) {
        setIsFrozen(true);
        setFreezeMessage('Cannot meet minimum team requirements.');
      } else {
        setIsFrozen(false);
        setFreezeMessage('');
      }
    } catch (error) {
      console.error('Error checking budget freeze:', error);
    }
  };

  useEffect(() => {
    if (currentParticipant && myTeam) {
      checkBudgetFreeze();
    }
  }, [myTeam.length, currentParticipant?.current_budget]);

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

  if (round1Complete && access?.canControl) {
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
          <p style={{ color: '#666', fontSize: '16px', marginBottom: '30px' }}>
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
            }}
          >
            🎯 GO TO ROUND 2 SETUP
          </button>
        </div>
      </div>
    );
  }

  if (round1Complete && !access?.canControl) {
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
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>⏳</div>
          <h1 style={{ color: '#02084b', fontSize: '32px', marginBottom: '15px' }}>
            Waiting for Round 2
          </h1>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Admin is preparing Round 2...
          </p>
        </div>
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
        background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)'
      }}>
        <p style={{ color: 'white', fontSize: '18px' }}>Loading player...</p>
      </div>
    );
  }

  const nextBidAmount = getNextBidAmount();
  const teamComplete = myTeam.length >= 15;
  
  const canBid = access?.canBid && 
                 currentParticipant && 
                 currentParticipant.current_budget >= nextBidAmount && 
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
              🔥 ROUND 2 AUCTION
            </div>
          )}

          {access?.isAdmin && !access?.isParticipant && (
            <div style={{
              background: '#ff9800',
              color: 'white',
              padding: '10px',
              borderRadius: '8px',
              textAlign: 'center',
              marginBottom: '15px',
              fontWeight: 'bold',
            }}>
              👑 Viewing as Admin
            </div>
          )}

          <div style={{
            background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '15px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  {playersSold} / {totalPlayers}
                </span>
              </div>
              <div style={{ fontSize: '14px' }}>
                {totalPlayers - playersSold} remaining
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <div style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: getTimerColor(),
            }}>
              {auctionState.timer_seconds}
            </div>
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
                <p style={{ color: '#02084b', fontWeight: 'bold' }}>{currentPlayer.country}</p>
              </div>
              <div>
                <p style={{ color: '#666', fontSize: '10px' }}>Role</p>
                <p style={{ color: '#02084b', fontWeight: 'bold' }}>{currentPlayer.role}</p>
              </div>
              <div>
                <p style={{ color: '#666', fontSize: '10px' }}>Class</p>
                <p style={{ color: '#02084b', fontWeight: 'bold' }}>{currentPlayer.class_band}</p>
              </div>
            </div>
          </div>

          {auctionState.freeze_message && (
            <div style={{
              background: '#4caf50',
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
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#02084b' }}>
                  {auctionState.current_bid_amount} points
                </p>
                <p style={{ color: '#666' }}>
                  by <strong>{currentBidder.managers.team_name || currentBidder.managers.manager_name}</strong>
                </p>
              </>
            ) : (
              <p style={{ color: '#856404', fontSize: '16px', fontWeight: 'bold' }}>No bids yet!</p>
            )}
          </div>

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
            </div>
          )}

          {access?.canControl && (
            <div style={{ textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                onClick={handlePause}
                style={{
                  padding: '8px 20px',
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
          )}
        </div>
      </div>

      {access?.isParticipant && currentParticipant && (
        <div style={{ width: '420px' }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
          }}>
            <h3 style={{ color: '#02084b', marginBottom: '10px' }}>
              {currentParticipant.managers.team_name || currentParticipant.managers.manager_name}
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              marginBottom: '12px',
            }}>
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px' }}>
                <p style={{ color: '#666', fontSize: '11px' }}>Budget</p>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#02084b' }}>
                  {currentParticipant.current_budget}
                </p>
              </div>
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px' }}>
                <p style={{ color: '#666', fontSize: '11px' }}>Players</p>
                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#02084b' }}>
                  {myTeam.length} / 15
                </p>
              </div>
            </div>

            <div>
              <h4 style={{ color: '#02084b', marginBottom: '10px' }}>
                Squad ({myTeam.length})
              </h4>
              {myTeam.length === 0 ? (
                <p style={{ color: '#666', fontSize: '12px', textAlign: 'center' }}>
                  No players yet
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
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuctionPage() {
  return (
    <Suspense fallback={<div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh'
    }}>
      <p>Loading...</p>
    </div>}>
      <AuctionPageContent />
    </Suspense>
  );
}