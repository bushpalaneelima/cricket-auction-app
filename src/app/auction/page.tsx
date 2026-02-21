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
  const [displayTimer, setDisplayTimer] = useState<number>(30);
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
  if (!auctionState) return;
  if (auctionState.is_paused) {
    setDisplayTimer(auctionState.timer_seconds ?? 0);
    return;
  }

  setDisplayTimer(30);

  const interval = setInterval(() => {
    setDisplayTimer((prev) => (prev > 0 ? prev - 1 : 0));
  }, 1000);

  return () => clearInterval(interval);
}, [
  auctionState?.is_paused,
  auctionState?.current_player_id,
]);

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
                managers (
                  manager_id,
                  manager_name,
                  email,
                  role
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
      .on(
  'postgres_changes',
  {
    event: 'INSERT',
    schema: 'public',
    table: 'team_players',
    filter: `auction_id=eq.${auctionState.auction_id}`,
  },
  () => {
    console.log('Player sold (this auction)');
    if (currentParticipant) {
      refreshCurrentParticipant();
      loadMyTeam(currentParticipant.participant_id);
      if (auctionState) {
        loadPlayerStats(auctionState);
      }
    } else if (auctionState) {
      // Admin-only view (no participant)
      loadPlayerStats(auctionState);
    }
  }
)
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
  // Only ADMIN should run the DB timer
  if (!auctionState || !access?.canControl) return;

  // Don't run timer if paused or if there is no current player
  if (auctionState.is_paused || !currentPlayer) return;

  const interval = setInterval(async () => {
    // 1) Read current timer from DB (single source of truth)
    const { data: currentAuction, error } = await supabase
      .from("auctions")
      .select("timer_seconds, is_paused")
      .eq("auction_id", auctionState.auction_id)
      .single();

    if (error || !currentAuction) {
      console.error("Timer read failed:", error);
      return;
    }

    // 2) If paused in DB, stop ticking
    if (currentAuction.is_paused) {
      clearInterval(interval);
      return;
    }

    // 3) If timer is finishing -> set to 0 and sell/unsold + next player
    if ((currentAuction.timer_seconds ?? 0) <= 1) {
  clearInterval(interval);
  await handlePlayerSold();  // ✅ skip the zero update entirely
  return;
}
    // 4) Normal tick: decrement by 1
    const { error: tickErr } = await supabase
      .from("auctions")
      .update({ timer_seconds: currentAuction.timer_seconds - 1 })
      .eq("auction_id", auctionState.auction_id);

    if (tickErr) {
      console.error("Timer tick update failed:", tickErr);
    }
  }, 1000);

  return () => clearInterval(interval);
}, [
  auctionState?.auction_id,
  auctionState?.is_paused,
  access?.canControl,
  currentPlayer?.player_id,
]);

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
          managers (
            manager_id,
            manager_name,
            email,
            role
            
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
          managers (
            manager_id,
            manager_name,
            email,
            role
          
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
            freeze_message: null,  // ✅ add this line
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
    const message = `${currentParticipant.managers.manager_name} bid ${nextBidAmount} pts!`;

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

    setAuctionState(prev => prev ? {
      ...prev,
      current_bid_amount: nextBidAmount,
      current_bid_participant_id: currentParticipant.participant_id,
      timer_seconds: 30,
      freeze_message: null,
    } : prev);
    setDisplayTimer(30);



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
  if (!auctionState) return;

  isProcessingSaleRef.current = true;

  try {
    const { data: latestAuction, error: auctionErr } = await supabase
      .from("auctions")
      .select("*")
      .eq("auction_id", auctionState.auction_id)
      .single();

    if (auctionErr || !latestAuction) {
      console.error("Could not load latest auction:", auctionErr);
      return;
    }

    if (!latestAuction.current_player_id) {
      console.warn("No current_player_id on auction");
      return;
    }

    const { data: latestPlayer, error: playerErr } = await supabase
      .from("players")
      .select("*")
      .eq("player_id", latestAuction.current_player_id)
      .single();

    if (playerErr || !latestPlayer) {
      console.error("Could not load latest player:", playerErr);
      return;
    }

    let participant: any = null;
    const currentRound = latestAuction.status === "round2" ? 2 : 1;

    // SOLD path
    if (latestAuction.current_bid_participant_id && latestAuction.current_bid_amount > 0) {
      const { data: participantData, error: partErr } = await supabase
        .from("auction_participants")
        .select(`
          participant_id,
          manager_id,
          current_budget,
          managers (
            manager_name
          )
        `)
        .eq("participant_id", latestAuction.current_bid_participant_id)
        .single();

      if (partErr || !participantData) {
        console.error("Could not load participant:", partErr);
        return;
      }

      participant = participantData;

      // Upsert team_players (prevents duplicate 409)
      const { error: upsertErr } = await supabase
        .from("team_players")
        .upsert(
          {
            auction_id: latestAuction.auction_id,
            manager_id: participant.manager_id,
            player_id: latestPlayer.player_id,
            price: latestAuction.current_bid_amount,
            round: currentRound,
          },
          { onConflict: "auction_id,manager_id,player_id" }
        );

      if (upsertErr) {
        console.error("team_players upsert failed:", upsertErr);
        return;
      }

      // Deduct budget
      const newBudget = participant.current_budget - latestAuction.current_bid_amount;

      const { error: budgetErr } = await supabase
        .from("auction_participants")
        .update({ current_budget: newBudget })
        .eq("participant_id", latestAuction.current_bid_participant_id);

      if (budgetErr) {
        console.error("Budget update failed:", budgetErr);
        return;
      }
    } 
    // UNSOLD path
    else {
      if (latestAuction.status !== "round2") {
        const { data: existingUnsold, error: unsoldCheckErr } = await supabase
          .from("unsold_players")
          .select("unsold_id")
          .eq("auction_id", latestAuction.auction_id)
          .eq("player_id", latestPlayer.player_id)
          .maybeSingle();

        if (unsoldCheckErr) {
          console.error("Unsold check failed:", unsoldCheckErr);
          return;
        }

        if (!existingUnsold) {
          const { error: unsoldInsErr } = await supabase.from("unsold_players").insert({
            auction_id: latestAuction.auction_id,
            player_id: latestPlayer.player_id,
          });

          if (unsoldInsErr) {
            console.error("Unsold insert failed:", unsoldInsErr);
            return;
          }
        }
      }
    }

    // Freeze message (no team_name here)
    const soldToName = participant?.managers?.manager_name || "Manager";
    const soldMsg =
      latestAuction.current_bid_participant_id && latestAuction.current_bid_amount > 0
        ? `🎉 SOLD to ${soldToName} for ${latestAuction.current_bid_amount} pts!`
        : "⏭️ UNSOLD - Moving to next player...";

    const { error: freezeErr } = await supabase
      .from("auctions")
      .update({
        freeze_message: soldMsg,
        is_bid_locked: true,
        bid_freeze_until: new Date(Date.now() + 5000).toISOString(),
      })
      .eq("auction_id", latestAuction.auction_id);

    if (freezeErr) {
      console.error("Freeze update failed:", freezeErr);
      return;
    }
    setAuctionState(prev => prev ? {...prev, freeze_message: soldMsg} : prev);

    setTimeout(async () => {
  await supabase
    .from("auctions")
    .update({
      freeze_message: null,
      is_bid_locked: false,
      bid_freeze_until: null,
    })
    .eq("auction_id", latestAuction.auction_id);
  setAuctionState(prev => prev ? {...prev, freeze_message: null} : prev);

  setTimeout(async () => {
    await loadNextPlayer(latestAuction);
  }, 500);

}, 3000);

  } catch (e) {
    console.error("Error in handlePlayerSold:", e);
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

  const getTimerColor = (t: number) => {
  if (t > 20) return '#2e7d32';
  if (t > 10) return '#f57c00';
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
  return {
    'Batsman': Math.max(0, 3 - current.Batsman),
    'Bowler': Math.max(0, 3 - current.Bowler),
    'All-rounder': Math.max(0, 2 - current['All-rounder']),
    'Wicket Keeper': Math.max(0, 1 - current['Wicket Keeper']),
  };
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
              color: getTimerColor(displayTimer),
            }}>
              {displayTimer}
          </div>
          <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>seconds remaining</p>
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
              <div>
                <p style={{ color: '#666', fontSize: '10px' }}>Base Price</p>
                <p style={{ color: '#02084b', fontWeight: 'bold' }}>{currentPlayer.base_price} pts</p>
              </div>
              <div>
                <p style={{ color: '#666', fontSize: '10px' }}>Specialty</p>
                <p style={{ color: '#02084b', fontWeight: 'bold' }}>{currentPlayer.role_detail || '-'}</p>
              </div>
              <div>
                <p style={{ color: '#666', fontSize: '10px' }}>IPL Team</p>
                <p style={{ color: '#02084b', fontWeight: 'bold' }}>{currentPlayer.ipl_team || '-'}</p>
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
                <p style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>Current Highest Bid</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#02084b', margin: 0 }}>
                  {auctionState.current_bid_amount} points
                </p>
                <p style={{ color: '#666' }}>
                  by <strong>{currentBidder.managers.manager_name}</strong>
                </p>
              </>
            ) : (
              <>
                <p style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>Current Highest Bid</p>
                <p style={{ color: '#856404', fontSize: '16px', fontWeight: 'bold' }}>No bids yet!</p>
              </>
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
                <p style={{ color: '#666', fontSize: '12px', marginTop: '6px' }}>
                  Budget: {currentParticipant?.current_budget} pts
                </p>
              </div>
            )}

{access?.canControl && (
  <div style={{ marginTop: '15px' }}>
    
    {/* Row 1: Pause, Skip, Stop Round 1 */}
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
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
      <button
        onClick={async () => {
          if (!confirm('Are you sure you want to end Round 1 and go to Round 2?')) return;
          await supabase
            .from('auctions')
            .update({
              status: 'completed',
              current_player_id: null,
              current_bid_amount: 0,
              current_bid_participant_id: null,
              is_paused: true,
            })
            .eq('auction_id', auctionState.auction_id);
          router.push('/admin/round2');
        }}
        style={{
          padding: '8px 20px',
          background: '#d32f2f',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        🏁 END ROUND 1
      </button>
    </div>

    {/* Row 2: Filters */}
    <div style={{
      background: '#f8f9fa',
      padding: '12px',
      borderRadius: '8px',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexWrap: 'wrap',
      justifyContent: 'center',
    }}>
      <p style={{ color: '#02084b', fontWeight: 'bold', fontSize: '12px', margin: 0 }}>
        🎛️ Filters:
      </p>
      <select
        value={selectedClass}
        onChange={(e) => setSelectedClass(e.target.value)}
        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
      >
        <option value="">Class</option>
        <option value="Platinum">Platinum</option>
        <option value="Gold">Gold</option>
        <option value="Silver">Silver</option>
      </select>
      <select
        value={selectedRole}
        onChange={(e) => setSelectedRole(e.target.value)}
        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
      >
        <option value="">Role</option>
        <option value="Batsman">Batsman</option>
        <option value="Bowler">Bowler</option>
        <option value="All-rounder">All-rounder</option>
        <option value="Wicket Keeper">Wicket Keeper</option>
      </select>
      <button
        onClick={handleApplyFilters}
        style={{
          padding: '6px 14px',
          background: '#02084b',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        ✅ Apply
      </button>
    </div>

  </div>
)}        

  </div>
      </div>

      <p style={{ textAlign: 'center', color: '#ccc', fontSize: '11px', marginTop: '15px' }}>
            Powered by NB Blue Studios
          </p>




{access?.isParticipant && currentParticipant && (
  <div style={{ width: '420px' }}>
    <div style={{
      background: 'white',
      padding: '20px',
      borderRadius: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
  <h3 style={{ color: '#02084b', margin: 0 }}>
    {currentParticipant.managers.team_name || currentParticipant.managers.manager_name}
  </h3>
  <button
    onClick={() => { supabase.auth.signOut(); router.push('/login'); }}
    style={{
      padding: '6px 14px',
      background: '#d32f2f',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '12px',
    }}
  >
    🚪 Logout
  </button>
</div>
      {/* Budget and Players */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
        marginBottom: '12px',
      }}>
        <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px' }}>
          <p style={{ color: '#666', fontSize: '11px' }}>Budget</p>
          <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#02084b' }}>
            {currentParticipant.current_budget} / {currentParticipant.starting_budget}
          </p>
        </div>
        <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px' }}>
          <p style={{ color: '#666', fontSize: '11px' }}>Players</p>
          <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#02084b' }}>
            {myTeam.length} / 15
          </p>
        </div>
      </div>

      {/* Team Requirements */}
      <div style={{
        background: '#f8f9fa',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '12px',
      }}>
        <p style={{ color: '#02084b', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>
          📋 Team Requirements
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {[
            { role: 'Batsman', label: 'Batsmen', needed: 3 },
            { role: 'Bowler', label: 'Bowlers', needed: 3 },
            { role: 'All-rounder', label: 'All-rounders', needed: 2 },
            { role: 'Wicket Keeper', label: 'WK', needed: 1 },
          ].map(req => {
            const current = roleCounts[req.role as keyof RoleCounts];
            const met = current >= req.needed;
            return (
              <div key={req.role} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{met ? '✅' : '❌'}</span>
                <span style={{ fontSize: '12px', color: met ? '#2e7d32' : '#d32f2f' }}>
                  {req.label}: {current}/{req.needed}
                </span>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
          Total: {myTeam.length}/11 min
        </p>
      </div>

      {/* Squad */}
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
            maxHeight: '200px',
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
      <p style={{ textAlign: 'center', color: '#ccc', fontSize: '11px', marginTop: '15px' }}>
        Powered by NB Blue Studios
      </p>

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