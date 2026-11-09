import { AccountTab } from "@/settings/screens/account-tab"
import { AgentsTab } from "@/settings/screens/agents-tab"
import { UsageTab } from "@/settings/screens/usage-tab"
import { settingsRoutes } from "@/settings/settings-routes"

export const screens = {
  [settingsRoutes.usage]: UsageTab,
  [settingsRoutes.agents]: AgentsTab,
  [settingsRoutes.account]: AccountTab,
}
