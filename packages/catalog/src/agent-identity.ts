export const identityAgents = {
  "identity.alt": (value: string) => value,
  "identity.hidden": (value: boolean) => value,
  "identity.locked": (value: boolean) => value,
  "identity.mask": (value: boolean) => value,
} as const
