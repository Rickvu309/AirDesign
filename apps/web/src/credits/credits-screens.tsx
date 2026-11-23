import { creditsRoutes } from "@/credits/credits-routes"
import { LimitReached } from "@/credits/screens/limit-reached"
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
  [creditsRoutes.paymentFailed]: PaymentFailed,
  [creditsRoutes.paymentExpired]: PaymentExpired,
}
