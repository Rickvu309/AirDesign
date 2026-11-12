export type LimitKind = "deck" | "tool" | "turn"

export type CallerLog = {
  readonly events: readonly { readonly kind: LimitKind; readonly at: number }[]
}

export type AdmissionText =
  | `Five decks in one minute. The next deck can open in ${string} seconds.`
  | `Thirty tool calls in five minutes. The next tool call can run in ${string} seconds.`
  | `Twenty turns in five minutes. The next turn can start in ${string} seconds.`

export type Admission =
  | { readonly ok: true; readonly log: CallerLog }
  | { readonly ok: false; readonly log: CallerLog; readonly text: AdmissionText; readonly resetsAt: number }

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

function wholeSeconds(now: number, resetsAt: number): number {
  const seconds = Math.ceil((resetsAt - now) / 1000)
  if (seconds < 1) return 1
  return seconds
}

function sentence(kind: LimitKind, now: number, resetsAt: number): AdmissionText {
  const seconds = String(wholeSeconds(now, resetsAt))
  if (kind === "deck") return `Five decks in one minute. The next deck can open in ${seconds} seconds.`
  if (kind === "tool") return `Thirty tool calls in five minutes. The next tool call can run in ${seconds} seconds.`
  return `Twenty turns in five minutes. The next turn can start in ${seconds} seconds.`
}

function live(log: CallerLog, now: number): CallerLog {
  const events = log.events.filter((event) => now - event.at < windowOf[event.kind])
  if (events.length === log.events.length) return log
  return { events }
}

export function refund(log: CallerLog, kind: LimitKind): CallerLog {
  const at = log.events.findLastIndex((event) => event.kind === kind)
  if (at < 0) return log
  return { events: log.events.filter((_, position) => position !== at) }
}

export function admit(log: CallerLog, kind: LimitKind, now: number): Admission {
  const current = live(log, now)
  const window = windowOf[kind]
  let counted = 0
  let oldest: number | undefined
  for (const event of current.events) {
    if (event.kind !== kind) continue
    counted += 1
    if (oldest === undefined || event.at < oldest) oldest = event.at
  }
  if (counted >= limitOf[kind]) {
    if (oldest === undefined) throw new Error(kind)
    const resetsAt = oldest + window
    return { ok: false, log: current, text: sentence(kind, now, resetsAt), resetsAt }
  }
  return { ok: true, log: { events: [...current.events, { kind, at: now }] } }
}
