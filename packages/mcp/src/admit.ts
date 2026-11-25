export type LimitKind = "deck" | "tool" | "turn"

export type CallerLog = {
  readonly events: readonly { readonly kind: LimitKind; readonly at: number; readonly agent?: string }[]
}

export type AdmissionText =
  | `Five decks in one minute. The next deck can open in ${string} seconds.`
  | `Ninety tool calls in five minutes. The next tool call can run in ${string} seconds.`
  | `Three hundred tool calls in five minutes from this account's agents. The next tool call can run in ${string} seconds.`
  | `Twenty turns in five minutes. The next turn can start in ${string} seconds.`

export type Admission =
  | { readonly ok: true; readonly log: CallerLog }
  | { readonly ok: false; readonly log: CallerLog; readonly text: AdmissionText; readonly resetsAt: number }

const limitOf = {
  deck: 5,
  tool: 90,
  turn: 20,
} as const

const accountTools = 300

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

function sentence(kind: LimitKind, now: number, resetsAt: number, account: boolean): AdmissionText {
  const seconds = String(wholeSeconds(now, resetsAt))
  if (account)
    return `Three hundred tool calls in five minutes from this account's agents. The next tool call can run in ${seconds} seconds.`
  if (kind === "deck") return `Five decks in one minute. The next deck can open in ${seconds} seconds.`
  if (kind === "tool") return `Ninety tool calls in five minutes. The next tool call can run in ${seconds} seconds.`
  return `Twenty turns in five minutes. The next turn can start in ${seconds} seconds.`
}

function live(log: CallerLog, now: number): CallerLog {
  const events = log.events.filter((event) => now - event.at < windowOf[event.kind])
  if (events.length === log.events.length) return log
  return { events }
}

function oldest(events: CallerLog["events"]): number {
  return Math.min(...events.map((event) => event.at))
}

function refused(kind: LimitKind, log: CallerLog, now: number, from: number, account: boolean): Admission {
  const resetsAt = from + windowOf[kind]
  return { ok: false, log, text: sentence(kind, now, resetsAt, account), resetsAt }
}

export function admit(log: CallerLog, kind: LimitKind, now: number, agent?: string): Admission {
  const current = live(log, now)
  const counted = current.events.filter((event) => event.kind === kind)
  const own = kind === "tool" ? counted.filter((event) => event.agent === agent) : counted
  if (own.length >= limitOf[kind]) return refused(kind, current, now, oldest(own), false)
  if (kind === "tool" && counted.length >= accountTools) return refused(kind, current, now, oldest(counted), true)
  const event = agent === undefined ? { kind, at: now } : { kind, at: now, agent }
  return { ok: true, log: { events: [...current.events, event] } }
}
