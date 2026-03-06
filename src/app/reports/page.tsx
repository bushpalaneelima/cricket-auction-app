'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Manager {
  manager_id: number;
  manager_name: string;
  email: string;
  role: string;
}

interface Auction {
  auction_id: number;
  auction_name: string;
  status: string;
  tournament_filter: string | null;
  scheduled_at: string;
}

interface Player {
  player_id: number;
  player_name: string;
  country: string;
  role: string;
  class_band: string;
  base_price: number;
  // sold info — populated after cross-referencing team_players
  is_sold: boolean;
  sold_price: number | null;
}

interface LeaderboardEntry {
  manager_id: number;
  manager_name: string;
  player_count: number;
  total_spent: number;
  budget_remaining: number;
  starting_budget: number;
  avg_price: number;
  most_expensive: number;
}

interface TopPlayer {
  player_id: number;
  player_name: string;
  role: string;
  class_band: string;
  country: string;
  sold_price: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Manager | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'pool' | 'leaderboard'>('pool');

  // Pool toggle
  const [poolView, setPoolView] = useState<'full' | 'summary'>('full');

  // Auction selection
  const [myAuctions, setMyAuctions] = useState<Auction[]>([]);
  const [selectedAuctionId, setSelectedAuctionId] = useState<number | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);

  // Player pool data
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [countries, setCountries] = useState<string[]>([]);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [totalSold, setTotalSold] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  // ─── Auth & Init ────────────────────────────────────────────────────────────

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (selectedAuctionId) {
      const auction = myAuctions.find(a => a.auction_id === selectedAuctionId) || null;
      setSelectedAuction(auction);
      loadAuctionData(selectedAuctionId, auction?.tournament_filter || null);
    }
  }, [selectedAuctionId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

    const { data: mgr } = await supabase
      .from('managers')
      .select('*')
      .eq('email', session.user.email)
      .single();

    if (!mgr) { router.push('/login'); return; }

    setCurrentUser(mgr);
    const admin = mgr.role === 'admin';
    setIsAdmin(admin);

    await loadAuctions(mgr, admin);
    setLoading(false);
  };

  const loadAuctions = async (mgr: Manager, admin: boolean) => {
    let auctions: Auction[] = [];

    if (admin) {
      // Admin sees all auctions
      const { data } = await supabase
        .from('auctions')
        .select('auction_id, auction_name, status, tournament_filter, scheduled_at')
        .order('scheduled_at', { ascending: false });
      auctions = data || [];
    } else {
      // Manager sees only their auctions
      const { data: participations } = await supabase
        .from('auction_participants')
        .select('auction_id')
        .eq('manager_id', mgr.manager_id);

      if (participations && participations.length > 0) {
        const ids = participations.map(p => p.auction_id);
        const { data } = await supabase
          .from('auctions')
          .select('auction_id, auction_name, status, tournament_filter, scheduled_at')
          .in('auction_id', ids)
          .order('scheduled_at', { ascending: false });
        auctions = data || [];
      }
    }

    setMyAuctions(auctions);

    if (auctions.length > 0) {
      setSelectedAuctionId(auctions[0].auction_id);
      setSelectedAuction(auctions[0]);
      await loadAuctionData(auctions[0].auction_id, auctions[0].tournament_filter);
    }
  };

  // ─── Load all data for selected auction ─────────────────────────────────────

  const loadAuctionData = async (auctionId: number, tournamentFilter: string | null) => {
    await Promise.all([
      loadPlayerPool(auctionId, tournamentFilter),
      loadLeaderboard(auctionId),
    ]);
  };

  const loadPlayerPool = async (auctionId: number, tournamentFilter: string | null) => {
    // Get all players for this tournament
    let query = supabase.from('players').select('*');
    if (tournamentFilter) {
      query = query.eq(tournamentFilter, true);
    }
    const { data: players } = await query.order('player_name');
    if (!players) return;

    // Get sold players for this auction
    const { data: soldData } = await supabase
      .from('team_players')
      .select('player_id, price')
      .eq('auction_id', auctionId);

    const soldMap = new Map<number, number>();
    (soldData || []).forEach(s => soldMap.set(s.player_id, s.price));

    // Merge sold info into players
    const enriched: Player[] = players.map(p => ({
      player_id: p.player_id,
      player_name: p.player_name,
      country: p.country || '',
      role: p.role,
      class_band: p.class_band,
      base_price: p.base_price,
      is_sold: soldMap.has(p.player_id),
      sold_price: soldMap.get(p.player_id) ?? null,
    }));

    setAllPlayers(enriched);

    // Build unique country list
    const uniqueCountries = Array.from(new Set(enriched.map(p => p.country).filter(Boolean))).sort();
    setCountries(uniqueCountries);
  };

  const loadLeaderboard = async (auctionId: number) => {
    // Get participants with budgets from auction_participants (correct source)
    const { data: participants } = await supabase
      .from('auction_participants')
      .select(`
        participant_id,
        manager_id,
        starting_budget,
        current_budget,
        managers (manager_id, manager_name)
      `)
      .eq('auction_id', auctionId);

    if (!participants) return;

    // Get all team players for this auction
    const { data: teamPlayers } = await supabase
      .from('team_players')
      .select('manager_id, player_id, price')
      .eq('auction_id', auctionId);

    const tp = teamPlayers || [];

    // Build leaderboard
    const entries: LeaderboardEntry[] = participants.map(p => {
      const mgr = Array.isArray(p.managers) ? p.managers[0] : p.managers;
      const myPlayers = tp.filter(t => t.manager_id === mgr.manager_id);
      const totalSpent = myPlayers.reduce((sum, t) => sum + t.price, 0);
      const prices = myPlayers.map(t => t.price);

      return {
        manager_id: mgr.manager_id,
        manager_name: mgr.manager_name,
        player_count: myPlayers.length,
        total_spent: totalSpent,
        budget_remaining: p.current_budget,
        starting_budget: p.starting_budget,
        avg_price: myPlayers.length > 0 ? Math.round(totalSpent / myPlayers.length) : 0,
        most_expensive: prices.length > 0 ? Math.max(...prices) : 0,
      };
    });

    entries.sort((a, b) => b.total_spent - a.total_spent);
    setLeaderboard(entries);

    // Totals
    const allTp = tp;
    setTotalSold(allTp.length);
    setTotalSpent(allTp.reduce((sum, t) => sum + t.price, 0));

    // Top 10 most expensive players
    const sortedTp = [...allTp].sort((a, b) => b.price - a.price).slice(0, 10);
    if (sortedTp.length > 0) {
      const playerIds = sortedTp.map(t => t.player_id);
      const { data: playersData } = await supabase
        .from('players')
        .select('player_id, player_name, role, class_band, country')
        .in('player_id', playerIds);

      const playerMap = new Map(playersData?.map(p => [p.player_id, p]) || []);
      const top: TopPlayer[] = sortedTp
        .map(t => {
          const pl = playerMap.get(t.player_id);
          if (!pl) return null;
          return {
            player_id: t.player_id,
            player_name: pl.player_name,
            role: pl.role,
            class_band: pl.class_band,
            country: pl.country || '',
            sold_price: t.price,
          };
        })
        .filter(Boolean) as TopPlayer[];

      setTopPlayers(top);
    } else {
      setTopPlayers([]);
    }
  };

  // ─── Filtered players ────────────────────────────────────────────────────────

  const filteredPlayers = allPlayers.filter(p => {
    if (roleFilter && p.role !== roleFilter) return false;
    if (classFilter && p.class_band !== classFilter) return false;
    if (countryFilter && p.country !== countryFilter) return false;
    return true;
  });

  const availablePlayers = filteredPlayers.filter(p => !p.is_sold);
  const soldPlayers = filteredPlayers.filter(p => p.is_sold);

  // ─── CSV Downloads ───────────────────────────────────────────────────────────

  const downloadLeaderboardCSV = () => {
    const headers = ['Rank', 'Manager', 'Players', 'Total Spent', 'Budget Remaining', 'Avg Price', 'Most Expensive'];
    const rows = leaderboard.map((e, i) => [
      i + 1, e.manager_name, e.player_count, e.total_spent,
      e.budget_remaining, e.avg_price, e.most_expensive,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    downloadFile(csv, `auction-${selectedAuctionId}-leaderboard.csv`);
  };

  const downloadDetailedCSV = async () => {
    if (!selectedAuctionId) return;
    const { data: teamPlayers } = await supabase
      .from('team_players')
      .select(`player_id, price, round, manager_id, managers (manager_name)`)
      .eq('auction_id', selectedAuctionId)
      .order('manager_id');

    if (!teamPlayers || teamPlayers.length === 0) { alert('No data!'); return; }

    const playerIds = teamPlayers.map((t: any) => t.player_id);
    const { data: playersData } = await supabase
      .from('players')
      .select('player_id, player_name, role, class_band, country')
      .in('player_id', playerIds);

    const playerMap = new Map(playersData?.map(p => [p.player_id, p]) || []);
    const headers = ['Manager', 'Player', 'Role', 'Class', 'Country', 'Price', 'Round'];
    const rows = teamPlayers.map((t: any) => {
      const pl = playerMap.get(t.player_id);
      const mgr = Array.isArray(t.managers) ? t.managers[0] : t.managers;
      if (!pl || !mgr) return null;
      return [`"${mgr.manager_name}"`, `"${pl.player_name}"`, `"${pl.role}"`,
        `"${pl.class_band}"`, `"${pl.country || '-'}"`, t.price, t.round || 1].join(',');
    }).filter(Boolean);

    downloadFile([headers.join(','), ...rows].join('\n'), `auction-${selectedAuctionId}-players.csv`);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    window.URL.revokeObjectURL(url);
  };

  // ─── Class badge color ───────────────────────────────────────────────────────

  const classBadgeStyle = (cls: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      Platinum: { bg: '#e3f2fd', color: '#01579b' },
      Gold: { bg: '#fff8e1', color: '#e65100' },
      Silver: { bg: '#f3e5f5', color: '#6a1b9a' },
    };
    return colors[cls] || { bg: '#f5f5f5', color: '#333' };
  };

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F8F8FC' }}>
        <p>Loading reports...</p>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F8', padding: '20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
          padding: '25px 30px',
          borderRadius: '14px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{ fontSize: '26px', color: 'white', margin: 0, fontWeight: '700' }}>
              📊 Reports & Analysis
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '4px 0 0' }}>
              Player pool strategy + auction results
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Auction selector */}
            {myAuctions.length > 1 && (
              <select
                value={selectedAuctionId || ''}
                onChange={e => setSelectedAuctionId(Number(e.target.value))}
                style={{
                  padding: '8px 14px', borderRadius: '8px', border: 'none',
                  fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.15)', color: 'white',
                }}
              >
                {myAuctions.map(a => (
                  <option key={a.auction_id} value={a.auction_id} style={{ color: '#02084b' }}>
                    {a.auction_name}
                  </option>
                ))}
              </select>
            )}
            {myAuctions.length === 1 && (
              <span style={{
                padding: '8px 14px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '13px',
              }}>
                {myAuctions[0].auction_name}
              </span>
            )}
            <button
              onClick={() => router.push('/home')}
              style={{
                padding: '8px 18px', background: 'white', color: '#02084b',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontSize: '13px', fontWeight: '600',
              }}
            >
              ← Home
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[
            { key: 'pool', label: '🏏 Player Pool', desc: 'Strategy & availability' },
            { key: 'leaderboard', label: '🏆 Leaderboard', desc: 'Team comparison' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '12px 24px',
                background: activeTab === tab.key ? '#02084b' : 'white',
                color: activeTab === tab.key ? 'white' : '#02084b',
                border: `2px solid ${activeTab === tab.key ? '#02084b' : '#ddd'}`,
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
              <span style={{
                display: 'block', fontSize: '10px',
                color: activeTab === tab.key ? 'rgba(255,255,255,0.7)' : '#999',
                fontWeight: '400',
              }}>
                {tab.desc}
              </span>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1 — PLAYER POOL
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'pool' && (
          <div>
            {/* Pool stats bar */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px', marginBottom: '16px',
            }}>
              {[
                { label: 'Total Players', value: allPlayers.length, color: '#02084b' },
                { label: 'Available', value: allPlayers.filter(p => !p.is_sold).length, color: '#2e7d32' },
                { label: 'Sold', value: allPlayers.filter(p => p.is_sold).length, color: '#d32f2f' },
                { label: 'Tournament', value: selectedAuction?.tournament_filter?.replace('_active', '').replace('_', ' ').toUpperCase() || 'ALL', color: '#01579b' },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'white', padding: '16px', borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center',
                }}>
                  <p style={{ color: '#888', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {stat.label}
                  </p>
                  <p style={{ fontSize: '24px', fontWeight: '700', color: stat.color, margin: 0 }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Toggle + Filters row */}
            <div style={{
              background: 'white', padding: '16px 20px', borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '16px',
              display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
            }}>
              {/* Toggle */}
              <div style={{
                display: 'flex', background: '#f0f2f8', borderRadius: '8px', padding: '3px',
              }}>
                {[
                  { key: 'full', label: '📋 Full Pool' },
                  { key: 'summary', label: '⚡ Sold / Unsold' },
                ].map(v => (
                  <button
                    key={v.key}
                    onClick={() => setPoolView(v.key as any)}
                    style={{
                      padding: '7px 16px',
                      background: poolView === v.key ? '#02084b' : 'transparent',
                      color: poolView === v.key ? 'white' : '#666',
                      border: 'none', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: '600', transition: 'all 0.2s',
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              <div style={{ width: '1px', height: '32px', background: '#eee' }} />

              {/* Filters — only show in full pool view */}
              {poolView === 'full' && (
                <>
                  <span style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>Filter:</span>
                  {[
                    {
                      value: roleFilter, setter: setRoleFilter, label: 'Role',
                      options: ['Batsman', 'Bowler', 'All-rounder', 'Wicket Keeper'],
                    },
                    {
                      value: classFilter, setter: setClassFilter, label: 'Class',
                      options: ['Platinum', 'Gold', 'Silver'],
                    },
                    {
                      value: countryFilter, setter: setCountryFilter, label: 'Country',
                      options: countries,
                    },
                  ].map(f => (
                    <select
                      key={f.label}
                      value={f.value}
                      onChange={e => f.setter(e.target.value)}
                      style={{
                        padding: '7px 12px', borderRadius: '7px',
                        border: f.value ? '2px solid #02084b' : '1px solid #ddd',
                        fontSize: '12px', cursor: 'pointer', background: 'white',
                        fontWeight: f.value ? '600' : '400',
                        color: f.value ? '#02084b' : '#666',
                      }}
                    >
                      <option value="">All {f.label}s</option>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ))}
                  {(roleFilter || classFilter || countryFilter) && (
                    <button
                      onClick={() => { setRoleFilter(''); setClassFilter(''); setCountryFilter(''); }}
                      style={{
                        padding: '7px 12px', background: '#fee2e2', color: '#d32f2f',
                        border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                      }}
                    >
                      ✕ Clear
                    </button>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#888' }}>
                    {filteredPlayers.length} players
                  </span>
                </>
              )}
            </div>

            {/* ── Full Pool View ── */}
            {poolView === 'full' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '12px',
              }}>
                {filteredPlayers.map(player => {
                  const cls = classBadgeStyle(player.class_band);
                  return (
                    <div key={player.player_id} style={{
                      background: 'white',
                      borderRadius: '10px',
                      padding: '14px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      border: player.is_sold ? '2px solid #ffcdd2' : '2px solid #c8e6c9',
                      opacity: player.is_sold ? 0.85 : 1,
                      position: 'relative',
                    }}>
                      {/* Status badge */}
                      <div style={{
                        position: 'absolute', top: '10px', right: '10px',
                        padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700',
                        background: player.is_sold ? '#d32f2f' : '#2e7d32',
                        color: 'white',
                      }}>
                        {player.is_sold ? '🔴 SOLD' : '✅ AVAILABLE'}
                      </div>

                      <h4 style={{ fontSize: '14px', color: '#02084b', margin: '0 0 8px', fontWeight: '700', paddingRight: '70px' }}>
                        {player.player_name}
                      </h4>

                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '10px',
                          fontWeight: '600', background: cls.bg, color: cls.color,
                        }}>
                          {player.class_band}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '10px',
                          fontWeight: '600', background: '#f0f2f8', color: '#444',
                        }}>
                          {player.role}
                        </span>
                      </div>

                      <p style={{ fontSize: '11px', color: '#888', margin: '0 0 6px' }}>
                        🌍 {player.country}
                      </p>

                      <div style={{
                        marginTop: '8px', padding: '8px', borderRadius: '6px',
                        background: player.is_sold ? '#fff5f5' : '#f0fdf4',
                        textAlign: 'center',
                      }}>
                        <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>
                          {player.is_sold ? 'Sold Price' : 'Base Price'}
                        </p>
                        <p style={{
                          margin: 0, fontSize: '18px', fontWeight: '700',
                          color: player.is_sold ? '#d32f2f' : '#2e7d32',
                        }}>
                          {player.is_sold ? player.sold_price : player.base_price} pts
                        </p>
                      </div>
                    </div>
                  );
                })}

                {filteredPlayers.length === 0 && (
                  <div style={{
                    gridColumn: '1/-1', textAlign: 'center', padding: '60px',
                    color: '#999', background: 'white', borderRadius: '10px',
                  }}>
                    <p style={{ fontSize: '36px', margin: '0 0 10px' }}>🔍</p>
                    <p>No players match the current filters.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Sold / Unsold Summary View ── */}
            {poolView === 'summary' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Sold */}
                <div style={{
                  background: 'white', borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden',
                }}>
                  <div style={{
                    background: '#d32f2f', padding: '14px 20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <h3 style={{ color: 'white', margin: 0, fontSize: '16px', fontWeight: '700' }}>
                      🔴 Sold Players
                    </h3>
                    <span style={{
                      background: 'rgba(255,255,255,0.25)', color: 'white',
                      padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700',
                    }}>
                      {allPlayers.filter(p => p.is_sold).length}
                    </span>
                  </div>
                  <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {allPlayers.filter(p => p.is_sold).map(player => {
                      const cls = classBadgeStyle(player.class_band);
                      return (
                        <div key={player.player_id} style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #f5f5f5',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#02084b' }}>
                              {player.player_name}
                            </p>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                              <span style={{
                                padding: '1px 6px', borderRadius: '3px', fontSize: '9px',
                                fontWeight: '600', background: cls.bg, color: cls.color,
                              }}>
                                {player.class_band}
                              </span>
                              <span style={{ fontSize: '10px', color: '#888' }}>{player.role}</span>
                              <span style={{ fontSize: '10px', color: '#888' }}>• {player.country}</span>
                            </div>
                          </div>
                          <span style={{
                            fontSize: '14px', fontWeight: '700', color: '#d32f2f',
                            background: '#fff5f5', padding: '4px 10px', borderRadius: '6px',
                          }}>
                            {player.sold_price} pts
                          </span>
                        </div>
                      );
                    })}
                    {allPlayers.filter(p => p.is_sold).length === 0 && (
                      <p style={{ textAlign: 'center', color: '#999', padding: '30px', fontSize: '13px' }}>
                        No players sold yet
                      </p>
                    )}
                  </div>
                </div>

                {/* Unsold / Available */}
                <div style={{
                  background: 'white', borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden',
                }}>
                  <div style={{
                    background: '#2e7d32', padding: '14px 20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <h3 style={{ color: 'white', margin: 0, fontSize: '16px', fontWeight: '700' }}>
                      ✅ Available Players
                    </h3>
                    <span style={{
                      background: 'rgba(255,255,255,0.25)', color: 'white',
                      padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700',
                    }}>
                      {allPlayers.filter(p => !p.is_sold).length}
                    </span>
                  </div>
                  <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {allPlayers.filter(p => !p.is_sold).map(player => {
                      const cls = classBadgeStyle(player.class_band);
                      return (
                        <div key={player.player_id} style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #f5f5f5',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#02084b' }}>
                              {player.player_name}
                            </p>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                              <span style={{
                                padding: '1px 6px', borderRadius: '3px', fontSize: '9px',
                                fontWeight: '600', background: cls.bg, color: cls.color,
                              }}>
                                {player.class_band}
                              </span>
                              <span style={{ fontSize: '10px', color: '#888' }}>{player.role}</span>
                              <span style={{ fontSize: '10px', color: '#888' }}>• {player.country}</span>
                            </div>
                          </div>
                          <span style={{
                            fontSize: '12px', color: '#2e7d32',
                            background: '#f0fdf4', padding: '4px 10px', borderRadius: '6px',
                          }}>
                            Base: {player.base_price} pts
                          </span>
                        </div>
                      );
                    })}
                    {allPlayers.filter(p => !p.is_sold).length === 0 && (
                      <p style={{ textAlign: 'center', color: '#999', padding: '30px', fontSize: '13px' }}>
                        All players sold!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2 — LEADERBOARD
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'leaderboard' && (
          <div>
            {/* Summary cards */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px', marginBottom: '16px',
            }}>
              {[
                { label: 'Players Sold', value: totalSold, color: '#02084b' },
                { label: 'Total Points Spent', value: totalSpent, color: '#d32f2f' },
                { label: 'Avg Per Player', value: totalSold > 0 ? Math.round(totalSpent / totalSold) : 0, color: '#01579b' },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'white', padding: '20px', borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center',
                }}>
                  <p style={{ color: '#888', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {stat.label}
                  </p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: stat.color, margin: 0 }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Download buttons */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button onClick={downloadLeaderboardCSV} style={{
                padding: '9px 18px', background: '#28a745', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
              }}>
                📥 Download Summary
              </button>
              <button onClick={downloadDetailedCSV} style={{
                padding: '9px 18px', background: '#007bff', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
              }}>
                📋 Download Player Details
              </button>
            </div>

            {/* Leaderboard table */}
            <div style={{
              background: 'white', borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '16px', overflow: 'hidden',
            }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #eee' }}>
                <h2 style={{ fontSize: '18px', color: '#02084b', margin: 0, fontWeight: '700' }}>
                  🏆 Teams Leaderboard
                </h2>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      {['Rank', 'Manager', 'Players', 'Total Spent', 'Budget Left', 'Avg Price', 'Top Player Price'].map(h => (
                        <th key={h} style={{
                          padding: '12px 16px', textAlign: h === 'Rank' || h === 'Manager' ? 'left' : 'right',
                          color: '#666', fontSize: '11px', fontWeight: '600',
                          textTransform: 'uppercase', letterSpacing: '0.5px',
                          borderBottom: '2px solid #eee',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => {
                      const isMe = entry.manager_id === currentUser?.manager_id;
                      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
                      const budgetPct = Math.round((entry.budget_remaining / entry.starting_budget) * 100);
                      return (
                        <tr key={entry.manager_id} style={{
                          background: isMe ? '#e8f4fd' : 'white',
                          borderBottom: '1px solid #f0f0f0',
                        }}>
                          <td style={{ padding: '14px 16px', fontSize: '18px' }}>{medal}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#02084b' }}>
                              {entry.manager_name}
                              {isMe && <span style={{ color: '#1976d2', fontSize: '11px', marginLeft: '6px' }}>(You)</span>}
                            </p>
                            {/* Budget bar */}
                            <div style={{ marginTop: '4px', background: '#eee', borderRadius: '4px', height: '4px', width: '120px' }}>
                              <div style={{
                                height: '4px', borderRadius: '4px', width: `${budgetPct}%`,
                                background: budgetPct > 50 ? '#2e7d32' : budgetPct > 25 ? '#f57c00' : '#d32f2f',
                              }} />
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#02084b' }}>
                            {entry.player_count}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', fontWeight: '700', color: '#d32f2f' }}>
                            {entry.total_spent} pts
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', color: '#2e7d32', fontWeight: '600' }}>
                            {entry.budget_remaining} pts
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', color: '#666' }}>
                            {entry.avg_price} pts
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', color: '#ff9800', fontWeight: '700' }}>
                            {entry.most_expensive} pts
                          </td>
                        </tr>
                      );
                    })}
                    {leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                          No auction data yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top 10 Players */}
            {topPlayers.length > 0 && (
              <div style={{
                background: 'white', borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden',
              }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid #eee' }}>
                  <h2 style={{ fontSize: '18px', color: '#02084b', margin: 0, fontWeight: '700' }}>
                    💎 Top 10 Most Expensive Players
                  </h2>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '12px', padding: '16px',
                }}>
                  {topPlayers.map((player, index) => {
                    const cls = classBadgeStyle(player.class_band);
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    return (
                      <div key={player.player_id} style={{
                        padding: '14px', borderRadius: '10px',
                        background: index < 3 ? '#fff8e1' : '#f8f9fa',
                        border: index < 3 ? '2px solid #ff9800' : '1px solid #eee',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div>
                            <span style={{ fontSize: '20px' }}>{medal}</span>
                            <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '700', color: '#02084b' }}>
                              {player.player_name}
                            </p>
                          </div>
                          <span style={{
                            fontSize: '16px', fontWeight: '700', color: '#d32f2f',
                            background: '#fff5f5', padding: '4px 10px', borderRadius: '6px',
                          }}>
                            {player.sold_price} pts
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '4px', fontSize: '10px',
                            fontWeight: '600', background: cls.bg, color: cls.color,
                          }}>
                            {player.class_band}
                          </span>
                          <span style={{ fontSize: '11px', color: '#888', paddingTop: '2px' }}>
                            {player.role} • {player.country}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: '20px', color: '#999', fontSize: '12px' }}>
          Powered by <strong style={{ color: '#02084b' }}>NB Blue Studios</strong>
        </div>
      </div>
    </div>
  );
}
