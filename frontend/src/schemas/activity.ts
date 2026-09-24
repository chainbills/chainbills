// schemas/activity.ts
//
// Models the on-chain `ActivityRecord` struct and the flat log of activity
// types Chainbills emits (`ActivityType`), plus a `class Activity` that
// pairs a raw activity record with its resolved entity (a `Payable`,
// `UserPayment`, `PayablePayment`, `Withdrawal` or `User`) so the UI can
// render one unified feed across every kind of event.
//
// `ActivityType`'s member order mirrors `CbStructs.ActivityType` in
// `evm/src/CbStructs.sol` exactly — the on-chain `activityType` is a
// `uint8` index into this same order, so the order must never change
// without a matching contract change.
//
// Used by: `stores/activity.ts` (builds `Activity` instances from
// `getActivityRecord`/`getActivityRecordsBulk` plus bulk entity reads),
// `components/activity/*` (renders them).
import {
  type Chain,
  Payable,
  PayablePayment,
  TokenAndAmount,
  User,
  UserPayment,
  Withdrawal,
  type Token,
} from '@/schemas';

/** Mirrors `CbStructs.ActivityType` in `evm/src/CbStructs.sol`. Order matters — it is the on-chain `uint8` value. */
export enum ActivityType {
  /** A wallet's first interaction with Chainbills on a chain. `entity` is the wallet, left-padded to bytes32. */
  InitializedUser = 0,
  /** A host created a payable. `entity` is the payable id. */
  CreatedPayable = 1,
  /** A payer made a payment. `entity` is the `UserPayment` id, recorded on the payer's chain. */
  UserPaid = 2,
  /** A payable received a payment. `entity` is the `PayablePayment` id, recorded on the payable's home chain. */
  PayableReceived = 3,
  /** A host withdrew from a payable. `entity` is the withdrawal id. */
  Withdrew = 4,
  /** A host closed a payable to new payments. `entity` is the payable id. */
  ClosedPayable = 5,
  /** A host reopened a closed payable. `entity` is the payable id. */
  ReopenedPayable = 6,
  /** A host replaced the payable's accepted tokens/amounts. `entity` is the payable id. */
  UpdatedPayableAllowedTokensAndAmounts = 7,
  /** A host toggled the payable's auto-withdraw setting. `entity` is the payable id. */
  UpdatedPayableAutoWithdrawStatus = 8,
}

/** Visual severity for an activity row — maps to a UI accent color, never the only signal of meaning. */
export type ActivityTone = 'success' | 'info' | 'warning' | 'danger' | 'accent' | 'neutral';

/** Which activity feed tab(s) an activity type appears under. */
export type ActivityCategory = 'payments' | 'withdrawals' | 'payables' | 'users';

/** Static, chain-independent display metadata for one `ActivityType`. */
export interface ActivityTypeMeta {
  /** Short human label, e.g. "Payment received". */
  label: string;
  tone: ActivityTone;
  /** Icon key the UI's icon set resolves (the activity UI components map it to an icon component). */
  icon: string;
  category: ActivityCategory;
}

/** Display metadata for every `ActivityType`, indexed by its numeric value. */
export const activityTypeMeta: Record<ActivityType, ActivityTypeMeta> = {
  [ActivityType.InitializedUser]: { label: 'New user', tone: 'info', icon: 'user-plus', category: 'users' },
  [ActivityType.CreatedPayable]: { label: 'Payable created', tone: 'accent', icon: 'file-plus', category: 'payables' },
  [ActivityType.UserPaid]: { label: 'Payment sent', tone: 'info', icon: 'arrow-up-right', category: 'payments' },
  [ActivityType.PayableReceived]: {
    label: 'Payment received',
    tone: 'success',
    icon: 'arrow-down-left',
    category: 'payments',
  },
  [ActivityType.Withdrew]: { label: 'Withdrawal', tone: 'success', icon: 'wallet', category: 'withdrawals' },
  [ActivityType.ClosedPayable]: { label: 'Payable closed', tone: 'warning', icon: 'lock', category: 'payables' },
  [ActivityType.ReopenedPayable]: {
    label: 'Payable reopened',
    tone: 'info',
    icon: 'lock-open',
    category: 'payables',
  },
  [ActivityType.UpdatedPayableAllowedTokensAndAmounts]: {
    label: 'Accepted tokens updated',
    tone: 'neutral',
    icon: 'sliders',
    category: 'payables',
  },
  [ActivityType.UpdatedPayableAutoWithdrawStatus]: {
    label: 'Auto-withdraw updated',
    tone: 'neutral',
    icon: 'toggle-left',
    category: 'payables',
  },
};

/** Any entity type an `Activity`'s `entity` field can resolve to. */
export type ActivityEntity = Payable | UserPayment | PayablePayment | Withdrawal | User | null;

/**
 * One row of the on-chain activity log: the raw `ActivityRecord` plus,
 * once resolved by `stores/activity.ts`, the concrete entity it points at.
 * `entity` starts `null` until `useActivityStore().resolveEntities` fills
 * it in — callers must check for `null` before reading the derived getters.
 */
export class Activity {
  id: string;
  chain: Chain;
  /** This activity's position among all activity on `chain` (1-based). */
  chainCount: number;
  /** This activity's position among all activity for the acting user (1-based; 0 when not user-scoped). */
  userCount: number;
  /** This activity's position among all activity for the related payable (1-based; 0 when not payable-scoped). */
  payableCount: number;
  timestamp: number;
  /** Raw on-chain `bytes32` pointer: an id for most types, or a left-padded wallet for `InitializedUser`. */
  entityId: string;
  type: ActivityType;
  /** The resolved entity this activity points at, or `null` until resolved. */
  entity: ActivityEntity;

  constructor(id: string, chain: Chain, onChainData: any, entity: ActivityEntity = null) {
    this.id = id;
    this.chain = chain;
    this.chainCount = Number(onChainData.chainCount);
    this.userCount = Number(onChainData.userCount);
    this.payableCount = Number(onChainData.payableCount);
    this.timestamp = Number(onChainData.timestamp);
    this.entityId = onChainData.entity;
    this.type = Number(onChainData.activityType) as ActivityType;
    this.entity = entity;
  }

  /** Display metadata (label/tone/icon/category) for this activity's type. */
  get meta(): ActivityTypeMeta {
    return activityTypeMeta[this.type];
  }

  /** The payable this activity relates to, if any (every type except `InitializedUser`). */
  get payableId(): string | null {
    const e = this.entity;
    if (e instanceof Payable) return e.id;
    if (e instanceof UserPayment || e instanceof PayablePayment || e instanceof Withdrawal) return e.payableId;
    return null;
  }

  /** The wallet that performed this activity: the payer for a payment, the host otherwise. */
  get actor(): string | null {
    const e = this.entity;
    if (e instanceof User) return e.walletAddress;
    if (e instanceof Payable) return e.host;
    if (e instanceof UserPayment) return e.payer;
    if (e instanceof PayablePayment) return e.payer;
    if (e instanceof Withdrawal) return e.host;
    return null;
  }

  /** The token and amount involved, for payment/withdrawal activities; `null` for payable-settings and user activities. */
  get amount(): TokenAndAmount | null {
    const e = this.entity;
    if (e instanceof UserPayment || e instanceof PayablePayment || e instanceof Withdrawal) {
      return new TokenAndAmount(e.token as Token, e.amount);
    }
    return null;
  }

  /**
   * For a cross-chain payment activity, the chain on the *other* side of
   * the payment: the payable's chain for a `UserPaid` activity, or the
   * payer's chain for a `PayableReceived` activity. `null` otherwise.
   */
  get counterpartChain(): Chain | null {
    const e = this.entity;
    if (e instanceof UserPayment) return e.payableChain;
    if (e instanceof PayablePayment) return e.payerChain;
    return null;
  }

  /** True when this activity's payment crossed chains (payer chain differs from payable chain). */
  get isCrossChain(): boolean {
    return !!this.counterpartChain && this.counterpartChain.name !== this.chain.name;
  }
}
