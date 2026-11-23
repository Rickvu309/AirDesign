import { AccountNameScreen } from "@/account/account-name-page"
import { creditsRoutes } from "@/credits/credits-routes"
import { AccountTab } from "@/settings/screens/account-tab"
import { AgentsTab } from "@/settings/screens/agents-tab"
import {
  AddCreditsAmount,
  CreditsAdded,
  PaymentExpired,
  PaymentFailed,
  WaitingForPayment,
} from "@/settings/screens/credits-dialogs"
import { UsageTab } from "@/settings/screens/usage-tab"
import { settingsRoutes } from "@/settings/settings-routes"

export const screens = {
  "/screens/s01-01-sign-up-name": AccountNameScreen,
  [settingsRoutes.usage]: UsageTab,
  [settingsRoutes.agents]: AgentsTab,
  [settingsRoutes.account]: AccountTab,
  [creditsRoutes.amount]: AddCreditsAmount,
  [creditsRoutes.waiting]: WaitingForPayment,
  [creditsRoutes.added]: CreditsAdded,
  [creditsRoutes.paymentFailed]: PaymentFailed,
  [creditsRoutes.paymentExpired]: PaymentExpired,
}
