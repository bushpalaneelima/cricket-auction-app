'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Auction {
  auction_id: number;
  auction_name: string;
  tournament_filter: string;
  status: string;
  scheduled_at: string;
  class_filter: string;
  role_filter: string;
}

interface AuctionStats {
  auction_id: number;
  total_sold: number;
  total_unsold: number;
  total_spent: number;
}

export default function HistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<any>(null);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [auctionStats, setAuctionStats] = useState<Map<number, AuctionStats>>(new Map());

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

    if (!mgr) {
      router.push('/login');
      return;
    }

    setManager(mgr);

    if (mgr.role === 'admin') {
      await loadAllAuctions();
    } else {
      await loadManagerAuctions(mgr.manager_id);
    }

    setLoading(false);
  };

  // Admin: load every auction
  const loadAllAuctions = async () => {
    const { data: auctionsData } = await supabase
      .from('auctions')
      .select('*')
      .order('scheduled_at', { ascending: false });

    if (auctionsData) {
      setAuctions(auctionsData);
      await loadStats(auctionsData);
    }
  };

  // Manager: load only auctions they are a participant in
  const loadManagerAuctions = async (managerId: number) => {
    // Step 1: get auction IDs this manager participates in
    const { data: participations } = await supabase
      .from('auction_participants')
      .select('auction_id')
      .eq('manager_id', managerId);

    if (!participations || participations.length === 0) {
      setAuctions([]);
      return;
    }

    const auctionIds = participations.map(p => p.auction_id);

    // Step 2: fetch only those auctions
    const { data: auctionsData } = await supabase
      .from('auctions')
      .select('*')
      .in('auction_id', auctionIds)
      .order('scheduled_at', { ascending: false });

    if (auctionsData) {
      setAuctions(auctionsData);
      await loadStats(auctionsData);
    }
  };

  const loadStats = async (auctionsList: Auction[]) => {
    const statsMap = new Map<number, AuctionStats>();

    for (const auction of auctionsList) {
      const { data: soldData } = await supabase
        .from('team_players')
        .select('price')
        .eq('auction_id', auction.auction_id);

      const { data: unsoldData } = await supabase
        .from('unsold_players')
        .select('player_id')
        .eq('auction_id', auction.auction_id);

      const totalSold = soldData?.length || 0;
      const totalUnsold = unsoldData?.length || 0;
      const totalSpent = soldData?.reduce((sum: number, item: any) => sum + (item.price || 0), 0) || 0;

      statsMap.set(auction.auction_id, {
        auction_id: auction.auction_id,
        total_sold: totalSold,
        total_unsold: totalUnsold,
        total_spent: totalSpent,
      });
    }

    setAuctionStats(statsMap);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'round1':
      case 'round2':
        return '#28a745';
      case 'completed':
        return '#6c757d';
      case 'draft':
        return '#ffc107';
      default:
        return '#666';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return '🔴 Live';
      case 'round1': return '🔴 Round 1';
      case 'round2': return '🔴 Round 2';
      case 'completed': return '✅ Completed';
      case 'draft': return '📝 Draft';
      default: return status;
    }
  };

  const isLiveAuction = (status: string) =>
    ['active', 'round1', 'round2', 'draft'].includes(status);

  // Live auctions → lobby (ready check), completed → auction results view
  const viewAuctionDetails = (auction: Auction) => {
    if (isLiveAuction(auction.status)) {
      router.push(`/lobby?id=${auction.auction_id}`);
    } else {
      router.push(`/auction?id=${auction.auction_id}`);
    }
  };

  const deleteAuction = async (auctionId: number, auctionName: string) => {
    const confirmed = confirm(
      `🗑️ Delete "${auctionName}"?\n\n` +
      `This will permanently delete:\n` +
      `- All team_players records\n` +
      `- All unsold_players records\n` +
      `- All bids history\n` +
      `- The auction itself\n\n` +
      `This action CANNOT be undone!`
    );

    if (!confirmed) return;

    try {
      await supabase.from('bids').delete().eq('auction_id', auctionId);
      await supabase.from('team_players').delete().eq('auction_id', auctionId);
      await supabase.from('unsold_players').delete().eq('auction_id', auctionId);
      await supabase.from('auctions').delete().eq('auction_id', auctionId);

      alert(`✅ Auction "${auctionName}" deleted successfully!`);
      loadAllAuctions();
    } catch (error) {
      console.error('Error deleting auction:', error);
      alert('Failed to delete auction. Check console for details.');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#F8F8FC',
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  const isAdmin = manager?.role === 'admin';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F8FC',
      padding: '20px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '28px', color: '#02084b', marginBottom: '5px' }}>
                🏆 Auction History
              </h1>
              <p style={{ color: '#666', fontSize: '14px' }}>
                {isAdmin
                  ? 'All auctions — admin view'
                  : 'Auctions you have participated in'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => router.push('/home')}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#02084b',
                  border: '2px solid #02084b',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                ← Back to Home
              </button>
              {isAdmin && (
                <button
                  onClick={() => router.push('/admin/setup')}
                  style={{
                    padding: '10px 20px',
                    background: '#02084b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  + Create New Auction
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Empty state */}
        {auctions.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '60px 20px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          }}>
            <p style={{ fontSize: '48px', marginBottom: '10px' }}>📭</p>
            <h2 style={{ color: '#02084b', marginBottom: '10px' }}>
              {isAdmin ? 'No Auctions Yet' : 'No Auctions Found'}
            </h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              {isAdmin
                ? 'Create your first auction to get started!'
                : 'You have not been added to any auction yet. Ask the admin.'}
            </p>
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/setup')}
                style={{
                  padding: '12px 30px',
                  background: '#02084b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                }}
              >
                Create Auction
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {auctions.map((auction) => {
              const stats = auctionStats.get(auction.auction_id);
              const live = isLiveAuction(auction.status);

              return (
                <div
                  key={auction.auction_id}
                  style={{
                    background: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    border: live ? '2px solid #28a745' : '1px solid #eee',
                  }}
                >
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '20px',
                    alignItems: 'center',
                  }}>
                    {/* Info */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <h2 style={{ fontSize: '20px', color: '#02084b', margin: 0 }}>
                          {auction.auction_name}
                        </h2>
                        <span style={{
                          padding: '4px 12px',
                          background: getStatusColor(auction.status),
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}>
                          {getStatusLabel(auction.status)}
                        </span>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '20px',
                        marginTop: '12px',
                      }}>
                        <div>
                          <p style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Tournament</p>
                          <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#02084b' }}>
                            {auction.tournament_filter || '—'}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Date</p>
                          <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#02084b' }}>
                            {new Date(auction.scheduled_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Players Sold</p>
                          <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#02084b' }}>
                            {stats?.total_sold || 0}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Total Spent</p>
                          <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#02084b' }}>
                            {stats?.total_spent || 0} pts
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                      <button
                        onClick={() => viewAuctionDetails(auction)}
                        style={{
                          padding: '8px 20px',
                          background: live ? '#28a745' : '#02084b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {live ? '🎯 Join Lobby' : '👁️ View Details'}
                      </button>

                      {/* Only admin can delete, and only non-live auctions */}
                      {isAdmin && !live && (
                        <button
                          onClick={() => deleteAuction(auction.auction_id, auction.auction_name)}
                          style={{
                            padding: '8px 20px',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          paddingTop: '20px',
          color: '#999',
          fontSize: '12px',
        }}>
          Powered by <strong style={{ color: '#02084b' }}>NB Blue Studios</strong>
        </div>
      </div>
    </div>
  );
}
