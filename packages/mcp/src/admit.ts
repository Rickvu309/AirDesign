export type LimitKind = "deck" | "tool" | "turn"

export type CallerLog = {
  readonly events: readonly { readonly kind: LimitKind; readonly at: number }[]
}

export type Admission =
  | { readonly ok: true; readonly log: CallerLog }
  | { readonly ok: false; readonly log: CallerLog; readonly text: string; readonly resetsAt: number }

const limitOf = {
  deck: 5,
  tool: 30,
  turn: 20,
} as const

const windowOf = {
  deck: 60_000,
  tool: 300_000,
  turn: 300_000,
} as const

export function emptyLog(): CallerLog {
  return { events: [] }
}

function sentence(kind: LimitKind, resetsAt: number): string {
  const at = String(resetsAt)
  if (kind === "deck") return `Five decks in one minute. The next deck can open at ${at}.`
  if (kind === "tool") return `Thirty tool calls in five minutes. The next tool call can run at ${at}.`
  return `Twenty turns in five minutes. The next turn can start at ${at}.`
}

export function admit(log: CallerLog, kind: LimitKind, now: number): Admission {
  const window = windowOf[kind]
  let counted = 0
  let oldest: number | undefined
  for (const event of log.events) {
    if (event.kind !== kind) continue
    if (now - event.at >= window) continue
    counted += 1
    if (oldest === undefined || event.at < oldest) oldest = event.at
  }
  if (counted >= limitOf[kind]) {
    if (oldest === undefined) throw new Error(kind)
    const resetsAt = oldest + window
    return { ok: false, log, text: sentence(kind, resetsAt), resetsAt }
  }
  return { ok: true, log: { events: [...log.events, { kind, at: now }] } }
}
