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
  const [round1Complete, setRound1Complete] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  // Refs to prevent stale closures and double-execution
  const isTickingRef = useRef(false);
  const isProcessingSaleRef = useRef(false);
  const auctionStateRef = useRef<AuctionState | null>(null);
  // FIX: Ref so team_players subscription can read participant without stale closure
  const currentParticipantRef = useRef<Participant | null>(null);

  useEffect(() => {
    auctionStateRef.current = auctionState;
  }, [auctionState]);

  useEffect(() => {
    currentParticipantRef.current = currentParticipant;
  }, [currentParticipant]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (auctionState) {
      setSelectedClass(auctionState.class_filter || '');
      setSelectedRole(auctionState.role_filter || '');
    }
  }, [auctionState?.class_filter, auctionState?.role_filter]);

  // Display timer syncs from DB on every relevant change.
  // Adding timer_seconds as dependency is safe here because this effect never
  // writes back to DB — it only sets local display state.
  // This ensures all clients (participants, admin, slow-loaders) stay in sync.
  useEffect(() => {
    if (!auctionState) return;

    // Sync display from DB value every time DB timer changes
    setDisplayTimer(auctionState.timer_seconds ?? 30);

    // If paused or no player, just show the DB value — no local ticking
    if (auctionState.is_paused || !auctionState.current_player_id) return;

    // Local tick so display feels smooth between DB updates
    const interval = setInterval(() => {
      setDisplayTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [
    auctionState?.is_paused,
    auctionState?.current_player_id,
    auctionState?.timer_seconds, // ✅ re-sync display whenever DB timer changes
  ]);

  // ── Auction + team_players subscription ──────────────────────────────────
  // FIX: Does NOT require currentParticipant — subscribes as soon as auction_id
  // is known. This means slow loaders, participants with delayed auth, and
  // admin-only viewers all receive live updates without needing to refresh.
  // FIX: Unique channel name per auction_id prevents collisions across tabs.
  useEffect(() => {
    if (!auctionState?.auction_id) return;

    const channel = supabase
      .channel(`auction-updates-${auctionState.auction_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'auctions',
        filter: `auction_id=eq.${auctionState.auction_id}`,
      }, async (payload) => {
        const newAuction = payload.new as AuctionState;
        // Replace entire auction state from DB — single source of truth
        setAuctionState(newAuction);

        // FIX: Reset waiting screen when Round 2 starts
        if (newAuction.status === 'round2') {
          setRound1Complete(false);
        }


        // Update current bidder display
        if (newAuction.current_bid_participant_id) {
          const { data } = await supabase
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
            .single();
          setCurrentBidder(data as any);
        } else {
          setCurrentBidder(null);
        }

        // Update current player display
        if (newAuction.current_player_id) {
          const { data } = await supabase
            .from('players')
            .select('*')
            .eq('player_id', newAuction.current_player_id)
            .single();
          setCurrentPlayer(data || null);
        } else {
          setCurrentPlayer(null);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'team_players',
        filter: `auction_id=eq.${auctionState.auction_id}`,
      }, async () => {
        // Use ref to avoid stale closure
        const latest = auctionStateRef.current;
        if (latest) await loadPlayerStats(latest);

        // currentParticipant read from ref via closure — safe because this
        // effect only re-subscribes when auction_id changes, not on participant changes
        const participant = currentParticipantRef.current;
        if (participant) {
          await refreshCurrentParticipant();
          await loadMyTeam(participant.participant_id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auctionState?.auction_id]); // ✅ auction_id only — no currentParticipant dependency

  // ── Participant budget subscription (separate, optional) ──────────────────
  // Kept separate so it can re-subscribe when participant loads without
  // tearing down the main auction subscription.
  useEffect(() => {
    if (!currentParticipant?.participant_id) return;

    const channel = supabase
      .channel(`participant-updates-${currentParticipant.participant_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'auction_participants',
        filter: `participant_id=eq.${currentParticipant.participant_id}`,
      }, () => {
        refreshCurrentParticipant();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentParticipant?.participant_id]);

  const refreshCurrentParticipant = async () => {
    const participant = currentParticipantRef.current;
    if (!participant) return;
    try {
      const { data: updatedParticipant, error } = await supabase
        .from('auction_participants')
        .select('participant_id, manager_id, current_budget, starting_budget')
        .eq('participant_id', participant.participant_id)
        .single();

      if (error) {
        console.error('Error refreshing participant:', error);
        return;
      }

      if (updatedParticipant) {
        setCurrentParticipant({
          ...updatedParticipant,
          managers: participant.managers,
        } as any);
      }
    } catch (err) {
      console.error('Exception:', err);
    }
  };

  // FIX: DB timer with isTickingRef guard to prevent double-ticking after admin refresh
  useEffect(() => {
    if (!auctionState || !access?.canControl) return;
    if (auctionState.is_paused || !currentPlayer) return;

    const interval = setInterval(async () => {
      // FIX: Prevent concurrent ticks — if previous tick hasn't finished, skip this one
      if (isTickingRef.current) return;
      isTickingRef.current = true;

      try {
        // FIX 3: Don't tick if sale is being processed — prevents 1-2 extra decrements during SKIP
        if (isProcessingSaleRef.current) return;

        const { data: currentAuction, error } = await supabase
          .from('auctions')
          .select('timer_seconds, is_paused')
          .eq('auction_id', auctionState.auction_id)
          .single();

        if (error || !currentAuction) {
          console.error('Timer read failed:', error);
          return;
        }

        if (currentAuction.is_paused) {
          clearInterval(interval);
          return;
        }

        if ((currentAuction.timer_seconds ?? 0) <= 1) {
          clearInterval(interval);
          await handlePlayerSold();
          return;
        }

        await supabase
          .from('auctions')
          .update({ timer_seconds: currentAuction.timer_seconds - 1 })
          .eq('auction_id', auctionState.auction_id);

      } finally {
        // FIX: Always release lock so next tick can proceed
        isTickingRef.current = false;
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

    // FIX: If page loads when Round 2 already started, don't show waiting screen
      if (auction.status === 'round2') {
        setRound1Complete(false);
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

        let queryBuilder = supabase.from('players').select('*');

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
            freeze_message: null,
            is_paused: false, // FIX 2: Unpause for new player after SKIP/sold flow
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
          .update({ class_filter: nextCategory.class_band, role_filter: nextCategory.role })
          .eq('auction_id', auction.auction_id);
        await loadNextPlayer({ ...auction, class_filter: nextCategory.class_band, role_filter: nextCategory.role });
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
    const auctionToUse = auction || auctionStateRef.current;
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
          return { ...player, price: teamPlayer?.price || 0 };
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
  showToast('🚫 You have reached the maximum of 15 players!');
  return;
  }
    const nextBidAmount = getNextBidAmount();

    if (currentParticipant.current_budget < nextBidAmount) {
      showToast('⚠️ Insufficient budget!');
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
        showToast(`⚠️ Need ${totalMinimumCost} pts minimum for remaining players!`);
      return;
      }
    }

    const { data: currentAuction } = await supabase
      .from('auctions')
      .select('is_bid_locked, bid_freeze_until')
      .eq('auction_id', auctionState.auction_id)
      .single();

      if (currentAuction?.is_bid_locked) {
      showToast('⏱️ Another bid in progress!');
      return;
      }
    if (currentAuction?.bid_freeze_until) {
      const freezeEnd = new Date(currentAuction.bid_freeze_until).getTime();
      if (Date.now() < freezeEnd) {
        showToast('⏱️ Bidding frozen!');
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
       showToast('⚡ Another manager bid first!');
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

    // FIX: Don't set freeze_message to null here — let the subscription/timeout handle it
    // to avoid race condition between local clear and subscription update
    setAuctionState(prev => prev ? {
      ...prev,
      current_bid_amount: nextBidAmount,
      current_bid_participant_id: currentParticipant.participant_id,
      timer_seconds: 30,
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
      if (auctionState?.status === 'round2') return 5;
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

    // FIX 1: Pause timer immediately so it stops for everyone the instant SKIP is clicked
    // Without this, the DB timer ticks 1-2 more times during the sale pipeline
    await supabase
      .from('auctions')
      .update({ is_paused: true })
      .eq('auction_id', auctionState.auction_id);

    try {
      const { data: latestAuction, error: auctionErr } = await supabase
        .from('auctions')
        .select('*')
        .eq('auction_id', auctionState.auction_id)
        .single();

      if (auctionErr || !latestAuction) {
        console.error('Could not load latest auction:', auctionErr);
        return;
      }

      if (!latestAuction.current_player_id) {
        console.warn('No current_player_id on auction');
        return;
      }

      const { data: latestPlayer, error: playerErr } = await supabase
        .from('players')
        .select('*')
        .eq('player_id', latestAuction.current_player_id)
        .single();

      if (playerErr || !latestPlayer) {
        console.error('Could not load latest player:', playerErr);
        return;
      }

      let participant: any = null;
      const currentRound = latestAuction.status === 'round2' ? 2 : 1;

      if (latestAuction.current_bid_participant_id && latestAuction.current_bid_amount > 0) {
        const { data: participantData, error: partErr } = await supabase
          .from('auction_participants')
          .select(`
            participant_id,
            manager_id,
            current_budget,
            managers (
              manager_name
            )
          `)
          .eq('participant_id', latestAuction.current_bid_participant_id)
          .single();

        if (partErr || !participantData) {
          console.error('Could not load participant:', partErr);
          return;
        }

        participant = participantData;

        const { error: upsertErr } = await supabase
          .from('team_players')
          .upsert(
            {
              auction_id: latestAuction.auction_id,
              manager_id: participant.manager_id,
              player_id: latestPlayer.player_id,
              price: latestAuction.current_bid_amount,
              round: currentRound,
            },
            { onConflict: 'auction_id,manager_id,player_id' }
          );

        if (upsertErr) {
          console.error('team_players upsert failed:', upsertErr);
          return;
        }

        const newBudget = participant.current_budget - latestAuction.current_bid_amount;
        const { error: budgetErr } = await supabase
          .from('auction_participants')
          .update({ current_budget: newBudget })
          .eq('participant_id', latestAuction.current_bid_participant_id);

        if (budgetErr) {
          console.error('Budget update failed:', budgetErr);
          return;
        }
      } else {
        if (latestAuction.status !== 'round2') {
          const { data: existingUnsold, error: unsoldCheckErr } = await supabase
            .from('unsold_players')
            .select('unsold_id')
            .eq('auction_id', latestAuction.auction_id)
            .eq('player_id', latestPlayer.player_id)
            .maybeSingle();

          if (unsoldCheckErr) {
            console.error('Unsold check failed:', unsoldCheckErr);
            return;
          }

          if (!existingUnsold) {
            const { error: unsoldInsErr } = await supabase.from('unsold_players').insert({
              auction_id: latestAuction.auction_id,
              player_id: latestPlayer.player_id,
            });

            if (unsoldInsErr) {
              console.error('Unsold insert failed:', unsoldInsErr);
              return;
            }
          }
        }
      }

      const soldToName = participant?.managers?.manager_name || 'Manager';
      const soldMsg =
        latestAuction.current_bid_participant_id && latestAuction.current_bid_amount > 0
          ? `🎉 SOLD to ${soldToName} for ${latestAuction.current_bid_amount} pts!`
          : '⏭️ UNSOLD - Moving to next player...';

      const { error: freezeErr } = await supabase
        .from('auctions')
        .update({
          freeze_message: soldMsg,
          is_bid_locked: true,
          bid_freeze_until: new Date(Date.now() + 5000).toISOString(),
        })
        .eq('auction_id', latestAuction.auction_id);

      if (freezeErr) {
        console.error('Freeze update failed:', freezeErr);
        return;
      }

      setAuctionState(prev => prev ? { ...prev, freeze_message: soldMsg } : prev);

      setTimeout(async () => {
        await supabase
          .from('auctions')
          .update({
            freeze_message: null,
            is_bid_locked: false,
            bid_freeze_until: null,
          })
          .eq('auction_id', latestAuction.auction_id);

        setAuctionState(prev => prev ? { ...prev, freeze_message: null } : prev);

        setTimeout(async () => {
          await loadNextPlayer(latestAuction);
        }, 500);
      }, 3000);

    } catch (e) {
      console.error('Error in handlePlayerSold:', e);
    } finally {
      isProcessingSaleRef.current = false;
    }
  };

  // FIX: handlePause now reads current DB state before toggling
  // prevents stale local state causing wrong toggle
  const handlePause = async () => {
    if (!auctionState) return;
    if (!access?.canControl) return;

    const { data: current } = await supabase
      .from('auctions')
      .select('is_paused')
      .eq('auction_id', auctionState.auction_id)
      .single();

    if (!current) return;

    await supabase
      .from('auctions')
      .update({ is_paused: !current.is_paused })
      .eq('auction_id', auctionState.auction_id);
  };

  const handleGoToRound2Setup = () => {
    router.push('/admin/round2');
  };

  const handleApplyFilters = async () => {
    if (!auctionState || !access?.canControl) return;
    if (!selectedClass || !selectedRole) {
      showToast('⚠️ Please select both Class and Role');
      return;
    }

    await supabase
      .from('auctions')
      .update({ class_filter: selectedClass, role_filter: selectedRole })
      .eq('auction_id', auctionState.auction_id);

    const updatedAuction = { ...auctionState, class_filter: selectedClass, role_filter: selectedRole };
    await loadNextPlayer(updatedAuction);
  };
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const getTimerColor = (t: number) => {
    if (t > 20) return '#2e7d32';
    if (t > 10) return '#f57c00';
    return '#d32f2f';
  };

  const getRoleCounts = (): RoleCounts => {
    const counts: RoleCounts = { Batsman: 0, Bowler: 0, 'All-rounder': 0, 'Wicket Keeper': 0 };
    myTeam.forEach(player => {
      if (player.role in counts) counts[player.role as keyof RoleCounts]++;
    });
    return counts;
  };

  const getMissingRoles = (): RoleCounts => {
    const current = getRoleCounts();
    return {
      Batsman: Math.max(0, 3 - current.Batsman),
      Bowler: Math.max(0, 3 - current.Bowler),
      'All-rounder': Math.max(0, 2 - current['All-rounder']),
      'Wicket Keeper': Math.max(0, 1 - current['Wicket Keeper']),
    };
  };

  // ─── Compute budget freeze warning for participants ───────────────────────
  const getBudgetFreezeInfo = () => {
    if (!currentParticipant || !auctionState) return null;
    const nextBid = getNextBidAmount();
    const budgetAfterBid = currentParticipant.current_budget - nextBid;
    const playersAfterBid = myTeam.length + 1;
    const playersStillNeeded = Math.max(0, 11 - playersAfterBid);
    if (playersStillNeeded <= 0) return null;

    const missing = getMissingRoles();
    const missingCount = missing.Batsman + missing.Bowler + missing['All-rounder'] + missing['Wicket Keeper'];
    const playersToCalc = Math.max(missingCount, playersStillNeeded);
    const costPerPlayer = auctionState.status === 'round2' ? 5 : 60;
    const totalMin = playersToCalc * costPerPlayer;

    if (budgetAfterBid < totalMin) {
      const parts = [];
      if (missing.Batsman > 0) parts.push(`${missing.Batsman} Batsman(s): ${missing.Batsman * costPerPlayer} pts`);
      if (missing.Bowler > 0) parts.push(`${missing.Bowler} Bowler(s): ${missing.Bowler * costPerPlayer} pts`);
      if (missing['All-rounder'] > 0) parts.push(`${missing['All-rounder']} All-rounder(s): ${missing['All-rounder'] * costPerPlayer} pts`);
      if (missing['Wicket Keeper'] > 0) parts.push(`${missing['Wicket Keeper']} WK: ${missing['Wicket Keeper'] * costPerPlayer} pts`);
      return { totalMin, parts };
    }
    return null;
  };

  // ─── Loading & guard states ────────────────────────────────────────────────

  if (loading || !auctionState) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F8F8FC' }}>
        <p>Loading auction...</p>
      </div>
    );
  }

  if (round1Complete && access?.canControl) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', maxWidth: '500px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎉</div>
          <h1 style={{ color: '#02084b', fontSize: '32px', marginBottom: '15px' }}>Round 1 Complete!</h1>
          <p style={{ color: '#666', fontSize: '16px', marginBottom: '30px' }}>Ready to set up Round 2?</p>
          <button onClick={handleGoToRound2Setup} style={{ padding: '18px 50px', fontSize: '20px', fontWeight: 'bold', background: '#4caf50', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>
            🎯 GO TO ROUND 2 SETUP
          </button>
        </div>
      </div>
    );
  }

  if (round1Complete && !access?.canControl) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', maxWidth: '500px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>⏳</div>
          <h1 style={{ color: '#02084b', fontSize: '32px', marginBottom: '15px' }}>Waiting for Round 2</h1>
          <p style={{ color: '#666', fontSize: '16px' }}>Admin is preparing Round 2...</p>
        </div>
      </div>
    );
  }

  if (!currentPlayer) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)' }}>
        <p style={{ color: 'white', fontSize: '18px' }}>Loading player...</p>
      </div>
    );
  }

  const nextBidAmount = getNextBidAmount();
  const teamComplete = myTeam.length >= 15;
  const budgetFreezeInfo = getBudgetFreezeInfo();
  const isBiddingFrozen = !!budgetFreezeInfo;

  const canBid = access?.canBid &&
    currentParticipant &&
    currentParticipant.current_budget >= nextBidAmount &&
    !teamComplete &&
    !isBiddingFrozen;

  const roleCounts = getRoleCounts();

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    // FIX: Outer wrapper is flex column so footer sits at bottom of page
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Main content row */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '15px',
        padding: '15px',
        alignItems: 'flex-start',
      }}>

        {/* ── Left: Auction panel ── */}
        <div style={{ flex: 1 }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(2, 8, 75, 0.2)',
          }}>

            {/* Round 2 badge */}
            {auctionState.status === 'round2' && (
              <div style={{ background: '#ff9800', color: 'white', padding: '7px', borderRadius: '8px', textAlign: 'center', marginBottom: '8px', fontWeight: 'bold' }}>
                🔥 ROUND 2 AUCTION
              </div>
            )}

            {/* Admin viewing badge */}
            {access?.isAdmin && !access?.isParticipant && (
              <div style={{ background: '#ff9800', color: 'white', padding: '7px', borderRadius: '8px', textAlign: 'center', marginBottom: '8px', fontWeight: 'bold' }}>
                👑 Viewing as Admin
              </div>
            )}

            {/* Progress bar */}
            <div style={{ background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)', color: 'white', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{playersSold} / {totalPlayers}</span>
                <span style={{ fontSize: '14px' }}>{totalPlayers - playersSold} remaining</span>
              </div>
            </div>

            {/* Timer */}
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <div style={{ fontSize: '64px', fontWeight: 'bold', color: getTimerColor(displayTimer), lineHeight: 1 }}>
                {displayTimer}
              </div>
              <p style={{ color: '#666', fontSize: '11px', margin: '2px 0 0' }}>seconds</p>
            </div>

            {/* Player card */}
            <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '8px', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '20px', color: '#02084b', marginBottom: '8px', textAlign: 'center', margin: '0 0 8px' }}>
                {currentPlayer.player_name}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                  { label: 'Country', value: currentPlayer.country },
                  { label: 'Role', value: currentPlayer.role },
                  { label: 'Class', value: currentPlayer.class_band },
                  { label: 'Base Price', value: `${currentPlayer.base_price} pts` },
                  { label: 'Specialty', value: currentPlayer.role_detail || '—' },
                  { label: 'IPL Team', value: currentPlayer.ipl_team || '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ color: '#888', fontSize: '11px', margin: '0 0 2px' }}>{label}</p>
                    <p style={{ color: '#02084b', fontWeight: 'bold', fontSize: '13px', margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Freeze message (SOLD / bid notification) */}
            {auctionState.freeze_message && (
              <div style={{ background: '#4caf50', color: 'white', padding: '10px', borderRadius: '8px', marginBottom: '8px', textAlign: 'center', fontSize: '15px', fontWeight: 'bold' }}>
                {auctionState.freeze_message}
              </div>
            )}

            {/* Current bid display */}
            <div style={{
              background: currentBidder ? '#e3f2fd' : '#fff3cd',
              padding: '10px',
              borderRadius: '8px',
              marginBottom: '8px',
              textAlign: 'center',
            }}>
              {currentBidder && auctionState.current_bid_amount > 0 ? (
                <>
                  <p style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>Current Highest Bid</p>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#02084b', margin: 0 }}>
                    {auctionState.current_bid_amount} points
                  </p>
                  <p style={{ color: '#666', margin: '4px 0 0' }}>
                    by <strong>{currentBidder.managers.manager_name}</strong>
                  </p>
                </>
              ) : (
                <>
                  <p style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>Current Highest Bid</p>
                  <p style={{ color: '#856404', fontSize: '16px', fontWeight: 'bold', margin: '0 0 2px' }}>No bids yet!</p>
                  <p style={{ color: '#856404', fontSize: '13px', margin: 0 }}>
                    Starting: {auctionState.status === 'round2' ? 5 : currentPlayer.base_price} pts
                  </p>
                </>
              )}
            </div>

            {/* ── Participant bid section ── */}
            {access?.canBid && currentParticipant && (
              <div style={{ marginBottom: '10px' }}>

                {/* Budget frozen warning — restored from old UI */}
                {isBiddingFrozen && budgetFreezeInfo && (
                  <div style={{ background: '#ff9800', color: 'white', padding: '14px 16px', borderRadius: '8px', marginBottom: '10px' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '15px', margin: '0 0 6px' }}>⚠️ Bidding Frozen</p>
                    <p style={{ fontSize: '12px', margin: '0 0 4px' }}>
                      Insufficient funds! Need {budgetFreezeInfo.totalMin} pts minimum
                    </p>
                    <p style={{ fontSize: '11px', margin: 0, opacity: 0.9 }}>
                      ({budgetFreezeInfo.parts.join(', ')})
                    </p>
                  </div>
                )}

                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={handleBid}
                    disabled={!canBid || auctionState.is_paused || !!auctionState.is_bid_locked}
                    style={{
                      padding: '15px 40px',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      background: (!canBid || auctionState.is_paused || auctionState.is_bid_locked)
                        ? '#ccc'
                        : '#02084b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: (!canBid || auctionState.is_paused || auctionState.is_bid_locked)
                        ? 'not-allowed'
                        : 'pointer',
                      width: '100%',
                    }}
                  >
                    {isBiddingFrozen
                      ? '🚫 BIDDING FROZEN'
                      : auctionState.is_bid_locked
                        ? '⏱️ WAIT...'
                        : `🎯 BID ${nextBidAmount} POINTS`}
                  </button>
                  {isBiddingFrozen && (
                    <p style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px' }}>
                      Cannot afford minimum requirements
                    </p>
                  )}
                  {!isBiddingFrozen && (
                    <p style={{ color: '#666', fontSize: '12px', marginTop: '6px' }}>
                      Budget: {currentParticipant.current_budget} pts
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Admin controls ── */}
            {access?.canControl && (
              <div style={{ marginTop: '8px' }}>

                {/* Row 1: Pause | Skip | End Round 1 */}
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handlePause}
                    style={{
                      padding: '10px 24px',
                      background: 'white',
                      color: '#02084b',
                      border: '2px solid #02084b',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      minWidth: '110px',
                    }}
                  >
                    {auctionState.is_paused ? '▶️ RESUME' : '⏸️ PAUSE'}
                  </button>
                  <button
                    onClick={() => handlePlayerSold()}
                    style={{
                      padding: '10px 24px',
                      background: '#f57c00',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      minWidth: '90px',
                    }}
                  >
                    ⏭️ SKIP
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Are you sure you want to end Round 1 and go to Round 2?')) return;
                      await supabase
                        .from('auctions')
                        .update({ status: 'completed', current_player_id: null, current_bid_amount: 0, current_bid_participant_id: null, is_paused: true })
                        .eq('auction_id', auctionState.auction_id);
                      router.push('/admin/round2');
                    }}
                    style={{
                      padding: '10px 24px',
                      background: '#d32f2f',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      minWidth: '130px',
                    }}
                  >
                    🏁 END ROUND 1
                  </button>
                </div>

                {/* Row 2: Filters */}
                <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <p style={{ color: '#02084b', fontWeight: 'bold', fontSize: '12px', margin: 0 }}>🎛️ Filters:</p>
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
                    style={{ padding: '6px 14px', background: '#02084b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    ✅ Apply
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Right: Participant sidebar ── */}
        {access?.isParticipant && currentParticipant && (
          <div style={{ width: '420px', flexShrink: 0 }}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(2, 8, 75, 0.2)' }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ color: '#02084b', margin: 0, fontSize: '18px' }}>
                  {currentParticipant.managers.team_name || currentParticipant.managers.manager_name}
                </h3>
                <button
                  onClick={() => { supabase.auth.signOut(); router.push('/login'); }}
                  style={{ padding: '6px 14px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                >
                  🚪 Logout
                </button>
              </div>

              {/* Budget & Players */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '12px' }}>
                <div style={{
                  background: isBiddingFrozen ? '#fff3e0' : '#f8f9fa',
                  padding: '12px',
                  borderRadius: '8px',
                  border: isBiddingFrozen ? '1px solid #ff9800' : 'none',
                }}>
                  <p style={{ color: '#666', fontSize: '11px', margin: '0 0 4px' }}>Budget</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: isBiddingFrozen ? '#f57c00' : '#02084b', margin: 0 }}>
                    {currentParticipant.current_budget} / {currentParticipant.starting_budget}
                  </p>
                  {isBiddingFrozen && <p style={{ color: '#f57c00', fontSize: '10px', margin: '2px 0 0' }}>⚠️ Frozen</p>}
                </div>
                <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px' }}>
                  <p style={{ color: '#666', fontSize: '11px', margin: '0 0 4px' }}>Players</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#02084b', margin: 0 }}>
                    {myTeam.length} / 15
                  </p>
                </div>
              </div>

              {/* Team Requirements */}
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                <p style={{ color: '#02084b', fontWeight: 'bold', fontSize: '13px', margin: '0 0 8px' }}>📋 Team Requirements</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {[
                    { role: 'Batsman', label: 'Batsmen', needed: 3 },
                    { role: 'Bowler', label: 'Bowlers', needed: 3 },
                    { role: 'All-rounder', label: 'All-rounders', needed: 2 },
                    { role: 'Wicket Keeper', label: 'WK', needed: 1 },
                  ].map(req => {
                    const count = roleCounts[req.role as keyof RoleCounts];
                    const met = count >= req.needed;
                    const warn = count > 0 && !met;
                    return (
                      <div key={req.role} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{met ? '✅' : warn ? '⚠️' : '❌'}</span>
                        <span style={{ fontSize: '12px', color: met ? '#2e7d32' : warn ? '#f57c00' : '#d32f2f' }}>
                          {req.label}: {count}/{req.needed}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: '11px', color: '#666', margin: '8px 0 0' }}>
                  Total: {myTeam.length}/11 min
                </p>
              </div>

              {/* Squad */}
              <div>
                <h4 style={{ color: '#02084b', margin: '0 0 10px', fontSize: '14px' }}>
                  Squad ({myTeam.length})
                </h4>
                {myTeam.length === 0 ? (
                  <p style={{ color: '#999', fontSize: '12px', textAlign: 'center', padding: '10px 0' }}>
                    No players yet. Start bidding!
                  </p>
                ) : (
                  <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {myTeam.map((player) => (
                      <div
                        key={player.player_id}
                        style={{ padding: '8px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e0e0e0' }}
                      >
                        <p style={{ color: '#02084b', fontSize: '11px', fontWeight: 'bold', margin: '0 0 2px' }}>
                          {player.player_name}
                        </p>
                        <p style={{ color: '#666', fontSize: '10px', margin: 0 }}>
                          {player.price} pts · {player.role}
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

            {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '30px', left: '50%',
          transform: 'translateX(-50%)',
          background: '#333', color: 'white',
          padding: '12px 24px', borderRadius: '8px',
          fontSize: '14px', fontWeight: '600',
          zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {toastMessage}
        </div>
      )}

      {/* FIX: Single "Powered by" footer — centered at bottom of page, not floating in the layout */}
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '11px', padding: '10px 0 14px', margin: 0 }}>
        Powered by NB Blue Studios
      </p>
    </div>
  );
}

export default function AuctionPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    }>
      <AuctionPageContent />
    </Suspense>
  );
}
