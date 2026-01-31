// src/lib/manifold.ts
import { supabase } from './supabaseClient';
export const MANIFOLD_NFT_URL = 'https://manifold.xyz/@r41nb0w/id/4078311664';

// ---------------------------------------------------------
// 1. NFT SCHEDULE
// Paste your Manifold Claim Page URLs here in order.
// Index 0 = The first one they get. Index 1 = The one they get a month later.
// ---------------------------------------------------------
const NFT_SCHEDULE = [
  'https://app.manifold.xyz/c/REPLACE_WITH_YOUR_LINK_1', // NFT #1 (Start)
  'https://app.manifold.xyz/c/REPLACE_WITH_YOUR_LINK_2', // NFT #2 (Month 2)
  'https://app.manifold.xyz/c/REPLACE_WITH_YOUR_LINK_3', // NFT #3 (Month 3)
  // Add more as you mint them...
];

// Fallback if they run out of scheduled NFTs
const MANIFOLD_PROFILE_URL = 'https://manifold.xyz/@r41nb0w';

export async function claimRitualArtifact(userId: string) {
  console.log('Processing Claim for:', userId);

  try {
    // 1. GET HISTORY
    // Count how many artifacts this user has collected
    const { data: claims, error: fetchError } = await supabase
      .from('user_claims')
      .select('claimed_at, month_id') // month_id stores "nft-0", "nft-1"
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false }); // Newest first

    if (fetchError) throw fetchError;

    const claimCount = claims?.length || 0;
    const lastClaim = claims?.[0]; // The most recent one

    // 2. CHECK COOLDOWN (The "One per Month" Rule)
    // If they claimed recently, we don't give them the NEXT one yet.
    // We give them the CURRENT one (idempotency) in case they lost the link.
    
    const MIN_DAYS_BETWEEN_CLAIMS = 25; // slightly less than a month to be forgiving
    let isTooSoon = false;

    if (lastClaim) {
      const lastDate = new Date(lastClaim.claimed_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < MIN_DAYS_BETWEEN_CLAIMS) {
        isTooSoon = true;
      }
    }

    // 3. DETERMINE WHICH LINK TO GIVE
    let targetIndex = claimCount; 

    // If it's too soon to move to the next tier, return the PREVIOUS tier link
    // so they can finish minting if they missed it.
    if (isTooSoon && claimCount > 0) {
      targetIndex = claimCount - 1;
      
      const safeUrl = NFT_SCHEDULE[targetIndex] || MANIFOLD_PROFILE_URL;
      return {
        success: true,
        claimUrl: safeUrl,
        message: "Retrieving your current monthly artifact..."
      };
    }

    // 4. CHECK IF WE HAVE A REWARD FOR THIS LEVEL
    const nextNftUrl = NFT_SCHEDULE[targetIndex];

    if (!nextNftUrl) {
      return { success: true, claimUrl: MANIFOLD_PROFILE_URL, message: "You have collected all currently available artifacts!" };
    }

    // 5. RECORD THE NEW CLAIM (Only if we moved up an index)
    // We create a unique ID based on the index (e.g., "nft-0", "nft-1")
    const distinctId = `nft-${targetIndex}`;

    // Double check we haven't written this ID before (extra safety)
    const { error: insertError } = await supabase
      .from('user_claims')
      .insert([
        { user_id: userId, month_id: distinctId }
      ]);

    // If duplicate error (23505), it means they clicked twice fast. Just let them through.
    if (insertError && insertError.code !== '23505') {
        console.error('DB Error:', insertError);
    }

    return {
      success: true,
      claimUrl: nextNftUrl
    };

  } catch (err) {
    console.error('Logic Error:', err);
    return { success: true, claimUrl: MANIFOLD_PROFILE_URL };
  }
}