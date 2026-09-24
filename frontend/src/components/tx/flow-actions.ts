// src/components/tx/flow-actions.ts
//
// Shared logic for turning a succeeded `TxFlow`'s `kind` and `result` into
// the "next step" actions the UI offers for it — "View receipt", "Open
// payable", "Copy payment link". Used by `TxFlowDialog.vue` (the succeeded
// footer) and `TxBackgroundTray.vue` (the toast a background flow raises
// once it finishes), so the two stay consistent without duplicating the
// per-kind mapping.
import type { TxFlow } from '@/stores/tx-flow';

/** One action offered for a succeeded flow: a route to navigate to, or an arbitrary click handler (e.g. copying a link). */
export interface FlowAction {
  label: string;
  to?: string;
  onClick?: () => void;
}

const copyPaymentLink = (payableId: string) =>
  navigator.clipboard.writeText(`${window.location.origin}/pay/${payableId}`);

/** The actions to offer once `flow` has succeeded, chosen from its `kind` and the ids in its `result`. Empty for anything else. */
export const primaryActionsFor = (flow: TxFlow): FlowAction[] => {
  if (flow.status !== 'succeeded' || !flow.result) return [];
  const result = flow.result as Record<string, unknown>;

  switch (flow.kind) {
    case 'create-payable': {
      const id = result.payableId as string | undefined;
      if (!id) return [];
      return [
        { label: 'Open payable', to: `/payable/${id}` },
        { label: 'Copy payment link', onClick: () => copyPaymentLink(id) },
      ];
    }
    case 'pay':
    case 'pay-cross-chain': {
      const id = (result.paymentId ?? result.userPaymentId) as string | undefined;
      return id ? [{ label: 'View receipt', to: `/receipt/${id}` }] : [];
    }
    case 'withdraw': {
      const id = result.withdrawalId as string | undefined;
      return id ? [{ label: 'View receipt', to: `/receipt/${id}` }] : [];
    }
    default: {
      // close/reopen/update-* payable writes: the payable page is the natural next stop.
      const id = result.payableId as string | undefined;
      return id ? [{ label: 'Open payable', to: `/payable/${id}` }] : [];
    }
  }
};
