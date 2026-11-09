export const settingsRoutes = {
  usage: "/screens/s81-01-settings-settings-usage-tab",
  agents: "/screens/s81-02-settings-settings-agents-tab",
  account: "/screens/s81-03-settings-settings-account-tab",
} as const

export type SettingsTab = keyof typeof settingsRoutes
