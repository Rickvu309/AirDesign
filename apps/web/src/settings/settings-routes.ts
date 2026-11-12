export const settingsRoutes = {
  usage: "/screens/s81-01-settings-settings-usage-tab",
  agents: "/screens/s81-02-settings-settings-agents-tab",
  account: "/screens/s81-03-settings-settings-account-tab",
} as const

export type SettingsTab = keyof typeof settingsRoutes

export const settingsPaths = {
  usage: "/settings/usage",
  agents: "/settings/agents",
  account: "/settings/account",
} as const

export type SettingsPath = keyof typeof settingsPaths
