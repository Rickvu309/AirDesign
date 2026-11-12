import { decide, history, openRegister, replay, unsent, version, type Queued, type Register } from "@airdesign/document"
import { opened } from "./spec-register.js"

type Spec = Record<string, boolean | number | string>
type Graph = { states: Map<string, Spec>; edges: { from: string; to: string; action: string }[] }

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function changedKeys(source: Spec, target: Spec): string[] {
  const keys = new Set([...Object.keys(source), ...Object.keys(target)])
  return [...keys].filter((key) => source[key] !== target[key])
}

function num(spec: Spec, key: string): number {
  const value = spec[key]
  if (typeof value !== "number") throw new Error(`${key} is not a number`)
  return value
}

function flag(spec: Spec, key: string): boolean {
  const value = spec[key]
  if (typeof value !== "boolean") throw new Error(`${key} is not a boolean`)
  return value
}

function queueOf(spec: Spec): Queued[] {
  const queue: Queued[] = []
  if (flag(spec, "queued1")) queue.push({ base: 0, value: firstValue(spec) })
  if (flag(spec, "queued2")) queue.push({ base: 1, value: "two" })
  if (flag(spec, "stale")) queue.push({ base: 0, value: "stale" })
  return queue
}

function firstValue(spec: Spec): string {
  return flag(spec, "joined") ? "joined" : "one"
}

function ackOf(spec: Spec): number {
  return flag(spec, "acked1") ? 1 : 0
}

function offlineRegister(spec: Spec): Register {
  let register = openRegister("floor", "slide")
  const values: string[] = []
  if (flag(spec, "landed1")) values.push(firstValue(spec))
  if (flag(spec, "landed2")) values.push("two")
  for (const value of values) {
    const decision = decide(register, { command: "person", value })
    if (decision.decision !== "apply") throw new Error("offline person edit refused")
    register = decision.register
  }
  return register
}

function gained(before: readonly Queued[], after: readonly Queued[]): string | null {
  const left = before.map((item) => `${item.base}:${item.value}`)
  const extra: string[] = []
  for (const item of after) {
    const key = `${item.base}:${item.value}`
    if (left[0] === key) left.shift()
    else extra.push(item.value)
  }
  if (left.length !== 0 || extra.length !== 1) return null
  return extra[0]
}

function landedHistory(spec: Spec): string[] {
  const values: string[] = []
  if (flag(spec, "landed1")) values.push(firstValue(spec))
  if (flag(spec, "landed2")) values.push("two")
  return values
}

export function replayOffline(
  graph: Graph,
  where: (source: Spec, target: Spec, action: string) => string,
  failures: string[],
) {
  let replayed = 0
  let stuttered = 0
  const unconnected: Record<string, number> = { Crash: 0, Wipe: 0, Undo: 0 }
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing offline state for ${edge.action}`)
    const at = where(source, target, edge.action)
    if (edge.action === "Crash" || edge.action === "Wipe" || edge.action === "Undo") {
      unconnected[edge.action] += 1
      continue
    }
    if (edge.action === "Rest") {
      const changed = changedKeys(source, target)
      if (changed.length > 0) failures.push(`offline stutter ${at} changed ${changed.join(", ")}`)
      else stuttered += 1
      continue
    }
    const pending = unsent(queueOf(source), ackOf(source))
    const later = unsent(queueOf(target), ackOf(target))
    if (edge.action === "QueueFirst" || edge.action === "QueueSecond" || edge.action === "QueueStale") {
      const wanted = edge.action === "QueueFirst" ? "one" : edge.action === "QueueSecond" ? "two" : "stale"
      if (gained(pending, later) !== wanted) failures.push(`offline ${at} did not append an unsent edit`)
      else replayed += 1
      continue
    }
    if (edge.action === "Join") {
      const kept = later.length === pending.length && later.every((item, at) => item.base === pending[at]?.base)
      const last = pending.length === 1 && later.length === 1
      const newest = last && later[0]?.value === "joined" && flag(source, "sent1") === false
      if (!kept || !newest) failures.push(`offline ${at} did not join the newer text into the unsent row`)
      else replayed += 1
      continue
    }
    if (edge.action === "Send") {
      if (pending[0]?.value !== firstValue(source) || !same(later, pending))
        failures.push(`offline ${at} sent out of order`)
      else replayed += 1
      continue
    }
    if (edge.action === "SendNext") {
      const first = pending.findIndex((item) => item.value === firstValue(source))
      const second = pending.findIndex((item) => item.value === "two")
      const ordered =
        second >= 0 && !(first !== -1 && first < second && flag(source, "sent1") === false) && same(later, pending)
      if (!ordered) failures.push(`offline ${at} sent the second edit first`)
      else replayed += 1
      continue
    }
    if (edge.action === "Ack") {
      if (!same(later, pending.slice(1))) failures.push(`offline ${at} acknowledged out of order`)
      else replayed += 1
      continue
    }
    if (edge.action === "Land" || edge.action === "LandNext" || edge.action === "Skip" || edge.action === "LandStale") {
      const picked =
        edge.action === "Land"
          ? pending.filter((item) => item.value === firstValue(source)).slice(0, 1)
          : edge.action === "LandNext"
            ? pending.filter((item) => item.value === "two").slice(0, 1)
            : pending.filter((item) => item.value === "stale")
      const next = replay(offlineRegister(source), picked)
      const actual = { version: version(opened(next)), history: history(opened(next)) }
      const expected = { version: num(target, "version"), history: landedHistory(target) }
      if (!same(actual, expected)) {
        failures.push(`offline ${at}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`)
      } else replayed += 1
      continue
    }
    failures.push(`offline ${at} is not connected`)
  }
  return { replayed, stuttered, unconnected }
}
