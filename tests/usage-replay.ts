import { usage, type Command, type Ledger } from "@airdesign/usage"

type Spec = Record<string, boolean | number | string>
type Graph = { states: Map<string, Spec>; edges: { from: string; to: string; action: string }[] }

function num(spec: Spec, key: string): number {
  const value = spec[key]
  if (typeof value !== "number") throw new Error(`${key} is not a number`)
  return value
}

function text(spec: Spec, key: string): string {
  const value = spec[key]
  if (typeof value !== "string") throw new Error(`${key} is not text`)
  return value
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

const halfTokens = 100_000
const allTokens = 200_000

function usageLedger(spec: Spec): Ledger {
  const turn = text(spec, "turn")
  return {
    spent: num(spec, "spent"),
    open: turn === "none" ? null : { turn, hold: num(spec, "hold") },
    week: num(spec, "week"),
    outside: num(spec, "outside"),
  }
}

function usagePicture(ledger: Ledger) {
  return {
    spent: ledger.spent,
    hold: ledger.open?.hold ?? 0,
    turn: ledger.open?.turn ?? "none",
    week: ledger.week,
    outside: ledger.outside,
  }
}

function usageCommand(action: string): Command | null {
  const reserve = (maxTokens: number, search: number, searchOn: boolean, usOnly: boolean): Command => ({
    command: "reserve",
    id: "a",
    input: 0,
    maxTokens,
    coldPrefix: 0,
    search,
    searchOn,
    usOnly,
  })
  const settle = (
    id: string,
    output: number,
    search: number,
    searchOn: boolean,
    usOnly: boolean,
    command: "settle" | "stop" = "settle",
  ): Command => ({
    command,
    id,
    input: 0,
    output,
    write5m: 0,
    write1h: 0,
    read: 0,
    search,
    searchOn,
    usOnly,
  })
  if (action === "ReserveHalf" || action === "ReserveHalfRefused") return reserve(halfTokens, 0, false, false)
  if (action === "ReserveAll" || action === "ReserveAllRefused") return reserve(allTokens, 0, false, false)
  if (action === "ReserveZero") return reserve(0, 0, false, false)
  if (action === "ReserveSearch" || action === "ReserveSearchRefused") return reserve(halfTokens, 1, true, false)
  if (action === "ReserveUs" || action === "ReserveUsRefused") return reserve(halfTokens, 0, false, true)
  if (action === "SettleHalf" || action === "SettleAgain") return settle("a", halfTokens, 0, false, false)
  if (action === "SettleAll") return settle("a", allTokens, 0, false, false)
  if (action === "SettleOther") return settle("b", halfTokens, 0, false, false)
  if (action === "SettleSearch") return settle("a", halfTokens, 1, true, false)
  if (action === "SettleUs") return settle("a", halfTokens, 0, false, true)
  if (action === "StopHalf" || action === "StopAgain") return settle("a", halfTokens, 0, false, false, "stop")
  if (action === "StopAll") return settle("a", allTokens, 0, false, false, "stop")
  if (action === "StopOther") return settle("b", halfTokens, 0, false, false, "stop")
  if (action === "Release" || action === "ReleaseClosed") return { command: "release", id: "a" }
  if (action === "ReleaseOther") return { command: "release", id: "b" }
  if (action === "Monday") return { command: "monday" }
  if (action === "Outside") return { command: "outside" }
  return null
}

export function replayUsage(
  graph: Graph,
  where: (source: Spec, target: Spec, action: string) => string,
  failures: string[],
) {
  let replayed = 0
  let stuttered = 0
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing usage state for ${edge.action}`)
    const shown = where(source, target, edge.action)
    const command = usageCommand(edge.action)
    if (!command) {
      failures.push(`usage ${shown} is not connected`)
      continue
    }
    const result = usage(usageLedger(source), command)
    const actual = usagePicture(result.ledger)
    const expected = usagePicture(usageLedger(target))
    if (!same(actual, expected)) {
      failures.push(`usage ${shown}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`)
      continue
    }
    const changed = !same(usagePicture(usageLedger(source)), expected)
    if (changed !== result.accepted) {
      failures.push(`usage ${shown} accepted ${String(result.accepted)}`)
      continue
    }
    if (changed) replayed += 1
    else stuttered += 1
  }
  return { replayed, stuttered }
}
