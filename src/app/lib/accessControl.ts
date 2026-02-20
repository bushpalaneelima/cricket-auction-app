import { supabase } from './supabaseClient';

/**
 * Check if user can view/enter an auction
 * Admins can view ALL auctions
 * Participants can view auctions they're in
 */
export async function canViewAuction(
  userEmail: string,
  auctionId: number
): Promise<boolean> {
  // Get user's role and manager_id
  const { data: manager } = await supabase
    .from('managers')
    .select('manager_id, role')
    .eq('email', userEmail)
    .single();

  // Admin can view ALL auctions
  if (manager?.role === 'admin') {
    return true;
  }

  if (!manager) {
    return false;
  }

  // Check if user is a participant in THIS auction
  const { data: participant } = await supabase
    .from('auction_participants')
    .select('participant_id')
    .eq('auction_id', auctionId)
    .eq('manager_id', manager.manager_id)
    .single();

  return !!participant;
}

/**
 * Check if user can bid in an auction
 * Only participants can bid (even admins need to be participants)
 */
export async function canBid(
  userEmail: string,
  auctionId: number
): Promise<{ canBid: boolean; participantId?: number; budget?: number }> {
  // Get user
  const { data: manager } = await supabase
    .from('managers')
    .select('manager_id, role')
    .eq('email', userEmail)
    .single();

  if (!manager) {
    return { canBid: false };
  }

  // Check if user is a participant in THIS auction
  const { data: participant } = await supabase
    .from('auction_participants')
    .select('participant_id, current_budget')
    .eq('auction_id', auctionId)
    .eq('manager_id', manager.manager_id)
    .single();

  if (!participant) {
    return { canBid: false };
  }

  return {
    canBid: true,
    participantId: participant.participant_id,
    budget: participant.current_budget,
  };
}

/**
 * Check if user has admin controls
 * Only admins can pause, skip, control auction
 */
export async function hasAdminControls(userEmail: string): Promise<boolean> {
  const { data: manager } = await supabase
    .from('managers')
    .select('role')
    .eq('email', userEmail)
    .single();

  return manager?.role === 'admin';
}

/**
 * Get user's complete access for an auction
 * Returns all permissions at once
 */
export async function getAuctionAccess(
  userEmail: string,
  auctionId: number
): Promise<{
  canView: boolean;
  canBid: boolean;
  canControl: boolean;
  isAdmin: boolean;
  isParticipant: boolean;
  participantId?: number;
  budget?: number;
}> {
  // Get user
  const { data: manager } = await supabase
    .from('managers')
    .select('manager_id, role')
    .eq('email', userEmail)
    .single();

  if (!manager) {
    return {
      canView: false,
      canBid: false,
      canControl: false,
      isAdmin: false,
      isParticipant: false,
    };
  }

  const isAdmin = manager.role === 'admin';

  // Check participation
  const { data: participant } = await supabase
    .from('auction_participants')
    .select('participant_id, current_budget')
    .eq('auction_id', auctionId)
    .eq('manager_id', manager.manager_id)
    .single();

  const isParticipant = !!participant;

  return {
    canView: isAdmin || isParticipant,
    canBid: isParticipant,
    canControl: isAdmin,
    isAdmin,
    isParticipant,
    participantId: participant?.participant_id,
    budget: participant?.current_budget,
  };
}