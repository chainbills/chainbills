/**
 * Feature flags. Flip a boolean here, rebuild, redeploy. Every consumer imports
 * `FEATURES.<name>` and short-circuits when the flag is off: routes drop out
 * of the router, nav entries disappear, entry-point buttons vanish, and any
 * page a disabled feature owned starts serving the 404 view.
 *
 * emailNotifications: the /me/email verification flow, the /notifications
 * page, its wallet-menu entry, and the optional email section on the create
 * payable form.
 *
 * scan: the /scan and /scan/address/:address pages, every nav entry that
 * points at them, and every landing-page card or link that mentions Scan.
 */
export const FEATURES = {
  emailNotifications: false,
  scan: false,
  /**
   * relayStatus: fetch cross-chain relay status from the backend
   * (GET /payments/user/:id) instead of polling the destination chain
   * on-chain. Shows richer status: attempts, failure reason, and the
   * matched PayablePayment once the relay job completes.
   */
  relayStatus: false,
} as const;
