import { AccountTab } from "@/settings/screens/account-tab"
import { AgentsTab } from "@/settings/screens/agents-tab"
import { UsageTab } from "@/settings/screens/usage-tab"
import { settingsRoutes } from "@/settings/settings-routes"

import { AccountNameScreen } from "@/account/account-name-page"

export const screens = {
  "/screens/s01-01-sign-up-name": AccountNameScreen,
  [settingsRoutes.usage]: UsageTab,
  [settingsRoutes.agents]: AgentsTab,
  [settingsRoutes.account]: AccountTab,
}
