export const creditsRoutes = {
  amount: "/screens/s91-01-credits-add-credits-amount",
  waiting: "/screens/s91-02-credits-add-credits-waiting-for-payment",
  added: "/screens/s91-03-credits-add-credits-credits-added",
  limit: "/screens/s92-01-credits-out-of-usage-limit-reached",
  confirmReset: "/screens/s92-02-credits-out-of-usage-confirm-reset",
  addFirst: "/screens/s92-03-credits-out-of-usage-add-credits-first",
  resetComplete: "/screens/s92-04-credits-out-of-usage-reset-complete",
  paymentFailed: "/screens/s99-01-credits-errors-payment-failed",
  paymentExpired: "/screens/s99-02-credits-errors-payment-expired",
} as const
