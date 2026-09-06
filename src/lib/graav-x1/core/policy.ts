import { X1 } from './config';
import type { Binding, Touch } from './types';

export function attributionPolicy(input: { action: string; touch: Touch | null; binding: Binding | null; buyerWallet: string; buyerX: string | null; creator: string | null; executedAt: number }): string {
  const { touch, binding } = input;
  if (input.action !== 'BUY') return 'NOT_BUY';
  if (!touch) return 'NO_VIA';
  if (!touch.via || !touch.bind_id || !touch.wallet) return touch.reason === 'CANDIDATE' ? 'UNBOUND_VIA' : touch.reason;
  if (touch.touched_at > input.executedAt || input.executedAt >= touch.expires_at || input.executedAt - touch.touched_at >= X1.touchTtl) return 'VIA_EXPIRED';
  if (!binding || binding.id !== touch.bind_id || binding.wallet !== touch.wallet || binding.x_user_id !== touch.via || binding.revoked_at !== null) return 'BIND_CHANGED_OR_REVOKED';
  if (input.buyerX === touch.via) return 'SELF_X';
  if (input.buyerWallet.toLowerCase() === touch.wallet.toLowerCase()) return 'SELF_WALLET';
  if (!input.creator) return 'CREATOR_UNVERIFIED';
  if (input.creator.toLowerCase() === touch.wallet.toLowerCase()) return 'CREATOR_WALLET';
  return 'ELIGIBLE';
}
/** Requested labels/order. Shadow testnet accounting; not a mutation of live V2 fees. */
export function feeSplit(fundedWei: string, eligible: boolean) {
  const amount = BigInt(fundedWei), creatorBps = eligible ? 60 : 75, protocolBps = 25, distributorBps = eligible ? 15 : 0;
  const totalFeeWei = amount * 100n / 10000n;
  const protocolWei = amount * 25n / 10000n;
  const distributorWei = amount * BigInt(distributorBps) / 10000n;
  // Any integer dust stays with creator, so allocations exactly sum to the shadow fee.
  return { creatorBps, protocolBps, distributorBps, creatorWei: (totalFeeWei - protocolWei - distributorWei).toString(), protocolWei: protocolWei.toString(), distributorWei: distributorWei.toString(), totalFeeWei: totalFeeWei.toString(), accounting: 'TESTNET_OFFCHAIN' as const };
}
