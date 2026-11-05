export const intentKinds = ["home", "new-deck", "import", "connect-agent"] as const

export type IntentKind = (typeof intentKinds)[number]

export function isIntentKind(value: string): value is IntentKind {
  return (intentKinds as readonly string[]).includes(value)
}
