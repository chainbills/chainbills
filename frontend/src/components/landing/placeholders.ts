// src/components/landing/placeholders.ts
//
// Every number, statistic and sample activity shown on the landing page
// (`HomeView.vue` and `src/components/landing/*`) is a hand-maintained
// placeholder defined in this one file. The landing page makes no on-chain
// or server reads (`frontend/docs/redesign/README.md` §1) — real figures
// live on `/scan` and the dashboard, which do read the chains. Whoever wants
// to freshen these numbers edits the constants below; nothing else on the
// page needs to change.
//
// Used by: `NumbersStrip.vue` (landingStats), `ActivityTicker.vue`
// (landingActivitySamples), `ChainConstellationVisual.vue` (heroReceipts).
import { ActivityType } from '@/schemas';
import type { ChainName } from '@/schemas';

/** The five headline figures shown in the numbers strip. Each is a
 *  pre-formatted string so the component never has to guess at grouping or
 *  currency symbols. */
export const landingStats: {
  payablesCreated: string;
  paymentsProcessed: string;
  withdrawalsCompleted: string;
  totalUsers: string;
  volumeReceived: string;
} = {
  payablesCreated: '1,842',
  paymentsProcessed: '6,530',
  withdrawalsCompleted: '1,205',
  totalUsers: '3,190',
  volumeReceived: '$482K',
};

/** One row of the illustrative activity ticker. Mirrors the shape of a real
 *  `Activity` (schemas/activity.ts) closely enough to reuse its display
 *  metadata (`activityTypeMeta`), but every field here is hand-typed rather
 *  than resolved from a contract read. */
export interface LandingActivitySample {
  /** Stable key for the `v-for` — not a real on-chain id. */
  id: string;
  /** Which `ActivityType` this row illustrates, for its icon/tone/label. */
  type: ActivityType;
  /** The chain this activity is shown as happening on. */
  chainName: ChainName;
  /** For a cross-chain payment row, the chain on the other side of the
   *  payment. Omitted for same-chain and non-payment activities. */
  counterpartChainName?: ChainName;
  /** Pre-formatted token amount, e.g. `"25 USDC"`. Omitted for activities
   *  that carry no amount (payable created, user joined). */
  amount?: string;
  /** A short mono-styled id-like string shown under the title, matching the
   *  "sub line with mono ids and addresses" activity-row recipe. */
  detail: string;
  /** Pre-formatted relative time, e.g. `"2m ago"`. */
  timeAgo: string;
}

/** Eight sample rows for the activity ticker (brief §2, section 6), covering
 *  every category the real feed can show: payments (same-chain and
 *  cross-chain), withdrawals, and payable lifecycle events. */
export const landingActivitySamples: LandingActivitySample[] = [
  {
    id: 'sample-1',
    type: ActivityType.PayableReceived,
    chainName: 'sepolia',
    amount: '25 USDC',
    detail: 'Payable 0x8f21…4a0c',
    timeAgo: '2m ago',
  },
  {
    id: 'sample-2',
    type: ActivityType.PayableReceived,
    chainName: 'megaeth',
    counterpartChainName: 'sepolia',
    amount: '0.01 ETH',
    detail: 'Payable 0x51ce…9b3d',
    timeAgo: '4m ago',
  },
  {
    id: 'sample-3',
    type: ActivityType.Withdrew,
    chainName: 'arctestnet',
    amount: '118 USDC',
    detail: 'Withdrawal 0x2a77…e610',
    timeAgo: '9m ago',
  },
  {
    id: 'sample-4',
    type: ActivityType.CreatedPayable,
    chainName: 'sepolia',
    detail: 'Payable 0x9d04…7f2b',
    timeAgo: '13m ago',
  },
  {
    id: 'sample-5',
    type: ActivityType.PayableReceived,
    chainName: 'arctestnet',
    counterpartChainName: 'sepolia',
    amount: '60 USDC',
    detail: 'Payable 0x3bc8…12aa',
    timeAgo: '17m ago',
  },
  {
    id: 'sample-6',
    type: ActivityType.UserPaid,
    chainName: 'megaeth',
    amount: '0.004 ETH',
    detail: 'Payment 0x77e1…d904',
    timeAgo: '22m ago',
  },
  {
    id: 'sample-7',
    type: ActivityType.ReopenedPayable,
    chainName: 'sepolia',
    detail: 'Payable 0x1f6a…c377',
    timeAgo: '28m ago',
  },
  {
    id: 'sample-8',
    type: ActivityType.Withdrew,
    chainName: 'megaeth',
    amount: '0.12 ETH',
    detail: 'Withdrawal 0x6c9f…3e18',
    timeAgo: '35m ago',
  },
];

/** One rotating "just received" message in the hero's chain-constellation
 *  visual — the central payable card cycles through these on a timer. */
export interface HeroReceipt {
  amount: string;
  chainName: ChainName;
}

/** The three receipts the hero visual's central card cycles through,
 *  matching brief §2 section 1's example copy. */
export const heroReceipts: HeroReceipt[] = [
  { amount: '25 USDC', chainName: 'sepolia' },
  { amount: '0.01 ETH', chainName: 'megaeth' },
  { amount: '40 USDC', chainName: 'arctestnet' },
];

/** The counter the hero card ticks up by one each time it cycles to a new
 *  receipt, purely decorative — it never reflects a real payment count. */
export const heroReceiptsStartingCount = 4128;
