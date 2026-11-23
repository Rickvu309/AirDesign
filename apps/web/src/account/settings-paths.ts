export const settingsPaths = {
  usage: "/settings/usage",
  agents: "/settings/agents",
  account: "/settings/account",
} as const

export type SettingsPath = keyof typeof settingsPaths
