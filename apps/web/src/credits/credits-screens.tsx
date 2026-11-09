import { creditsRoutes } from "@/credits/credits-routes"
import { AddCreditsFirst, ConfirmReset, LimitReached, ResetComplete } from "@/credits/screens/editor-dialogs"
import {
  AddCreditsAmount,
  CreditsAdded,
  PaymentExpired,
  PaymentFailed,
  WaitingForPayment,
} from "@/credits/screens/settings-dialogs"

export const screens = {
  [creditsRoutes.amount]: AddCreditsAmount,
  [creditsRoutes.waiting]: WaitingForPayment,
  [creditsRoutes.added]: CreditsAdded,
  [creditsRoutes.limit]: LimitReached,
  [creditsRoutes.confirmReset]: ConfirmReset,
  [creditsRoutes.addFirst]: AddCreditsFirst,
  [creditsRoutes.resetComplete]: ResetComplete,
  [creditsRoutes.paymentFailed]: PaymentFailed,
  [creditsRoutes.paymentExpired]: PaymentExpired,
}
