import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  compactChain,
  decide,
  decideUndo,
  history,
  openRegister,
  replay,
  unsent,
  version,
  type NodeName,
  type NodeRegister,
  type Phase,
  type Queued,
  type Register,
} from "@airdesign/document"
import { usage, type Command, type Ledger } from "@airdesign/usage"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import { group as editGroup, state as editState, step as editStep } from "../specs/edit/view.mjs"
import { group as offlineGroup, state as offlineState, step as offlineStep } from "../specs/offline/view.mjs"
import { group as runGroup, state as runState, step as runStep } from "../specs/run/view.mjs"
import { group as structureGroup, state as structureState, step as structureStep } from "../specs/structure/view.mjs"
import { group as undoGroup, state as undoState, step as undoStep } from "../specs/undo/view.mjs"
import { group as usageGroup, state as usageState, step as usageStep } from "../specs/usage/view.mjs"

type Value = boolean | number | string
type Spec = Record<string, Value>
type View = {
  state: (spec: Spec) => string
  step: (action: string, spec: Spec) => string | null
  group: (spec: Spec) => string
}
type Graph = {
  states: Map<string, Spec>
  edges: { from: string; to: string; action: string }[]
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const run = "r"

function parseValue(raw: string): Value {
  if (raw === "TRUE") return true
  if (raw === "FALSE") return false
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1)
  const number = Number(raw)
  if (Number.isNaN(number)) throw new Error(`bad value ${raw}`)
  return number
}

function parseLabel(label: string): Spec {
  const spec: Spec = {}
  for (const part of label.split("\n")) {
    const matched = part.match(/^\/\\ (\w+) = (.+)$/)
    if (!matched) throw new Error(`bad state line ${part}`)
    spec[matched[1]] = parseValue(matched[2])
  }
  return spec
}

function parseDot(dot: string): Graph {
  const states = new Map<string, Spec>()
  const edges: Graph["edges"] = []
  for (const line of dot.split("\n")) {
    const node = line.match(/^(-?\d+) \[label="(.*)"(?:,style = filled)?\]?;?$/)
    if (node) {
      const label = node[2].replaceAll("\\\\", "\\").replaceAll("\\n", "\n").replaceAll('\\"', '"')
      states.set(node[1], parseLabel(label))
      continue
    }
    const edge = line.match(/^(-?\d+) -> (-?\d+) \[label="([^"]+)"/)
    if (edge) edges.push({ from: edge[1], to: edge[2], action: edge[3] })
  }
  return { states, edges }
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function changedKeys(source: Spec, target: Spec, ignored: readonly string[]): string[] {
  const keys = new Set([...Object.keys(source), ...Object.keys(target)])
  const changed: string[] = []
  for (const key of keys) {
    if (ignored.includes(key)) continue
    if (source[key] !== target[key]) changed.push(key)
  }
  return changed
}

function readView(view: View, spec: Spec, action: string): string {
  const sentence = view.state(spec)
  const bucket = view.group(spec)
  const narrated = view.step(action, spec)
  if (typeof sentence !== "string" || typeof bucket !== "string") throw new Error(`${action} has no reader`)
  if (narrated !== null && typeof narrated !== "string") throw new Error(`${action} has no reader`)
  return `${bucket}: ${sentence}`
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

function text(spec: Spec, key: string): string {
  const value = spec[key]
  if (typeof value !== "string") throw new Error(`${key} is not text`)
  return value
}

function phaseOf(spec: Spec): Phase {
  const phase = text(spec, "phase")
  if (phase === "idle" || phase === "running" || phase === "stopped" || phase === "undone") return phase
  throw new Error(`bad phase ${phase}`)
}

function nodeRegister(spec: Spec): Register {
  const landed: NodeRegister["landed"][number][] = []
  for (let index = 0; index < num(spec, "personBefore"); index += 1) {
    landed.push({ actor: "person", value: "before", visible: true })
  }
  if (num(spec, "agent") === 1 || num(spec, "agentAt") !== -1) {
    landed.push({ actor: "agent", value: "agent", visible: num(spec, "agent") === 1 })
  }
  if (num(spec, "agent") === 2) {
    const at = landed.findIndex((row) => row.actor === "agent")
    const first = { actor: "agent" as const, value: "agent", visible: true }
    const second = { actor: "agent" as const, value: "again", visible: true }
    if (at >= 0) landed.splice(at, 1, first, second)
    else landed.push(first, second)
  }
  for (let index = 0; index < num(spec, "personAfter"); index += 1) {
    landed.push({ actor: "person", value: "later", visible: true })
  }
  const phase = phaseOf(spec)
  return {
    ...openRegister("floor", "slide"),
    landed,
    phase,
    runId: phase === "idle" ? null : run,
    readAt: num(spec, "readAt") === -1 ? null : num(spec, "readAt"),
    guarded: flag(spec, "guarded"),
    claimed: num(spec, "claims") === -1 ? null : num(spec, "claims"),
    stoppedAt: num(spec, "stoppedAt") === -1 ? null : num(spec, "stoppedAt"),
  }
}

function personSplit(register: NodeRegister): { personBefore: number; personAfter: number } {
  let personBefore = 0
  let personAfter = 0
  let seenAgent = false
  for (const row of register.landed) {
    if (row.actor === "agent") {
      seenAgent = true
      continue
    }
    if (!row.visible) continue
    if (seenAgent) personAfter += 1
    else personBefore += 1
  }
  return { personBefore, personAfter }
}

function editPicture(register: Register, positional: boolean) {
  const split = personSplit(register)
  const person = split.personBefore + split.personAfter
  const picture: Record<string, Value> = {
    phase: register.phase,
    version: version(register),
    readAt: register.readAt === null ? -1 : register.readAt,
    guarded: register.guarded,
    agent: register.landed.filter((row) => row.visible && row.actor === "agent").length,
    person,
  }
  if (positional) {
    picture.personBefore = split.personBefore
    picture.personAfter = split.personAfter
  }
  return picture
}

function editExpected(spec: Spec, positional: boolean) {
  const picture: Record<string, Value> = {
    phase: text(spec, "phase"),
    version: num(spec, "personBefore") + num(spec, "personAfter") + num(spec, "agent"),
    readAt: num(spec, "readAt"),
    guarded: flag(spec, "guarded"),
    agent: num(spec, "agent"),
    person: num(spec, "personBefore") + num(spec, "personAfter"),
  }
  if (positional) {
    picture.personBefore = num(spec, "personBefore")
    picture.personAfter = num(spec, "personAfter")
  }
  return picture
}

function replayEdit(graph: Graph, view: View, failures: string[]) {
  let replayed = 0
  let stuttered = 0
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing edit state for ${edge.action}`)
    const where = `${readView(view, source, edge.action)} -${edge.action}-> ${readView(view, target, edge.action)}`
    if (edge.action === "Done" || edge.action === "AgentRereads") {
      const ignored = edge.action === "AgentRereads" ? ["readAt"] : []
      const changed = changedKeys(source, target, ignored)
      if (changed.length > 0) failures.push(`edit stutter ${where} changed ${changed.join(", ")}`)
      else stuttered += 1
      continue
    }
    const register = nodeRegister(source)
    const positional = !(edge.action === "PersonWrites" && num(source, "agent") === 0 && num(source, "agentAt") !== -1)
    let next: Register | null = null
    if (edge.action === "PersonWrites") {
      const decision = decide(register, { command: "person", value: "person" })
      if (decision.decision !== "apply") failures.push(`edit ${where} refused ${decision.code}`)
      else next = decision.register
    } else if (edge.action === "RunStarts") {
      const decision = decide(register, { command: "start", runId: run })
      if (decision.decision !== "apply") failures.push(`edit ${where} refused ${decision.code}`)
      else next = decision.register
    } else if (edge.action === "AgentWrites") {
      const decision = decide(register, {
        command: "agent",
        runId: run,
        readAt: num(source, "readAt"),
        value: "agent",
      })
      if (decision.decision !== "apply") failures.push(`edit ${where} refused ${decision.code}`)
      else next = decision.register
      const other = num(source, "readAt") === 0 ? 1 : 0
      const stale = decide(register, { command: "agent", runId: run, readAt: other, value: "other" })
      if (stale.decision !== "refuse" || stale.code !== "stale") {
        failures.push(`edit ${where} accepted readAt ${other}`)
      }
    } else if (edge.action === "RunStops") {
      const decision = decide(register, { command: "stop", runId: run })
      if (decision.decision !== "apply") failures.push(`edit ${where} refused ${decision.code}`)
      else next = decision.register
    } else if (edge.action === "RunUndoes") {
      const decision = decide(register, { command: "undo", runId: run })
      if (decision.decision !== "apply") failures.push(`edit ${where} refused ${decision.code}`)
      else next = decision.register
    } else if (edge.action === "AgentWritesAgain" || edge.action === "AgentKeepsClaim") {
      const decision = decide(register, {
        command: "agent",
        runId: run,
        readAt: num(source, "readAt"),
        value: "again",
      })
      if (decision.decision !== "apply") failures.push(`edit ${where} refused ${decision.code}`)
      else next = decision.register
    } else if (edge.action === "AgentRefusesProtected") {
      const decision = decide(register, {
        command: "agent",
        runId: run,
        readAt: num(source, "readAt"),
        value: "stale",
      })
      if (decision.decision !== "refuse" || decision.code !== "person-protected") {
        failures.push(`edit ${where} accepted the read after a person`)
      } else replayed += 1
    } else {
      failures.push(`edit ${where} is not connected`)
      continue
    }
    if (next) {
      const actual = editPicture(next, positional)
      const expected = editExpected(target, positional)
      if (!same(actual, expected))
        failures.push(`edit ${where}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`)
      else replayed += 1
    }
  }
  return { replayed, stuttered }
}

function rowCounts(register: NodeRegister) {
  let person = 0
  let agent = 0
  let hidden = 0
  for (const row of register.landed) {
    if (row.actor === "person" && row.visible) person += 1
    if (row.actor === "agent" && row.visible) agent += 1
    if (row.actor === "agent" && !row.visible) hidden += 1
  }
  return { person, agent, hidden }
}

function undoRegister(spec: Spec): Register {
  const landed: NodeRegister["landed"][number][] = []
  if (num(spec, "person") === 1) landed.push({ actor: "person", value: "person", visible: true })
  if (num(spec, "agent") === 1 || num(spec, "hidden") === 1) {
    landed.push({ actor: "agent", value: "agent", visible: num(spec, "agent") === 1 })
  }
  const people = landed.filter((row) => row.visible && row.actor === "person").length
  return {
    ...openRegister("floor", "slide"),
    landed,
    phase: undoPhase(spec),
    runId: run,
    readAt: people,
    guarded: false,
  }
}

function undoPicture(register: NodeRegister) {
  return { phase: register.phase, ...rowCounts(register) }
}

function undoPhase(spec: Spec): Phase {
  if (flag(spec, "undoMark") || flag(spec, "dropped")) return "undone"
  return "running"
}

function undoExpected(spec: Spec) {
  return {
    phase: undoPhase(spec),
    person: num(spec, "person"),
    agent: num(spec, "agent"),
    hidden: num(spec, "hidden"),
  }
}

function replayUndo(graph: Graph, view: View, failures: string[]) {
  let replayed = 0
  let stuttered = 0
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing undo state for ${edge.action}`)
    const where = `${readView(view, source, edge.action)} -${edge.action}-> ${readView(view, target, edge.action)}`
    if (edge.action === "Done") {
      const changed = changedKeys(source, target, [])
      if (changed.length > 0) failures.push(`undo stutter ${where} changed ${changed.join(", ")}`)
      else stuttered += 1
      continue
    }
    const register = undoRegister(source)
    let picture: ReturnType<typeof undoPicture> | null = null
    if (edge.action === "PersonWrites") {
      const decision = decide(register, { command: "person", value: "person" })
      if (decision.decision !== "apply") failures.push(`undo ${where} refused ${decision.code}`)
      else picture = undoPicture(decision.register)
    } else if (edge.action === "AgentWrites") {
      const decision = decide(register, {
        command: "agent",
        runId: run,
        readAt: version(register),
        value: "agent",
      })
      if (decision.decision !== "apply") failures.push(`undo ${where} refused ${decision.code}`)
      else picture = undoPicture(decision.register)
    } else if (edge.action === "GiveHorizon") {
      picture = undoPicture(compactChain(register, false))
    } else if (edge.action === "Undo") {
      const decision = decideUndo(register, run)
      if (decision.decision !== "apply") failures.push(`undo ${where} refused ${decision.code}`)
      else picture = undoPicture(decision.body)
    } else if (edge.action === "Compact") {
      picture = undoPicture(compactChain(register, flag(source, "eligible")))
    } else {
      failures.push(`undo ${where} is not connected`)
      continue
    }
    if (picture) {
      const expected = undoExpected(target)
      if (edge.action === "Compact") expected.phase = undoPhase(source)
      if (!same(picture, expected)) {
        failures.push(`undo ${where}\n  actual ${JSON.stringify(picture)}\n  expected ${JSON.stringify(expected)}`)
      } else replayed += 1
    }
  }
  return { replayed, stuttered }
}

function nodeNames(hasA: boolean, hasB: boolean): NodeName[] {
  const names: NodeName[] = []
  if (hasA) names.push("a")
  if (hasB) names.push("b")
  return names
}

function structureRegister(spec: Spec): Register {
  const nodes = nodeNames(flag(spec, "nodeA"), flag(spec, "nodeB"))
  const readNodes = flag(spec, "didRead") ? nodeNames(flag(spec, "storedA"), flag(spec, "storedB")) : null
  const phase = phaseOf(spec)
  const runId = text(spec, "runId")
  return {
    ...openRegister("floor", "slide"),
    phase,
    runId,
    nodes,
    readNodes,
    b: flag(spec, "nodeB") ? { ...openRegister("floor", "slide"), phase, runId } : null,
  }
}

function structurePicture(register: Register) {
  return {
    nodes: register.nodes,
    readNodes: register.readNodes,
    phase: register.phase,
    runId: register.runId,
    personBefore: 0,
    personAfter: 0,
    agent: 0,
  }
}

function replayStructure(graph: Graph, view: View, failures: string[]) {
  let replayed = 0
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing structure state for ${edge.action}`)
    const where = `${readView(view, source, edge.action)} -${edge.action}-> ${readView(view, target, edge.action)}`
    const register = structureRegister(source)
    if (edge.action === "NameAbsent") {
      const decision = decide(register, { command: "person", value: "absent", node: "b" })
      const countsHeld =
        num(target, "personBefore") === num(source, "personBefore") &&
        num(target, "personAfter") === num(source, "personAfter") &&
        num(target, "agent") === num(source, "agent") &&
        flag(target, "nodeA") === flag(source, "nodeA") &&
        flag(target, "nodeB") === flag(source, "nodeB") &&
        (!flag(source, "didRead") ||
          same(register.readNodes, nodeNames(flag(target, "storedA"), flag(target, "storedB"))))
      if (decision.decision !== "refuse" || decision.code !== "dead" || !countsHeld) {
        failures.push(`structure ${where} did not refuse the absent node`)
      } else replayed += 1
      continue
    }
    const decision =
      edge.action === "AddNode"
        ? decide(register, { command: "add", node: "b" })
        : edge.action === "RemoveNode"
          ? decide(register, { command: "remove", node: "b" })
          : edge.action === "SecondRunReads"
            ? decide(register, { command: "read", runId: text(source, "readId"), node: "a" })
            : null
    if (decision === null) {
      failures.push(`structure ${where} is not connected`)
      continue
    }
    if (text(target, "lastKind") === "fenced") {
      const held =
        decision.decision === "refuse" &&
        decision.code === "run-fenced" &&
        flag(target, "nodeA") === flag(source, "nodeA") &&
        flag(target, "nodeB") === flag(source, "nodeB") &&
        flag(target, "didRead") === flag(source, "didRead") &&
        flag(target, "storedA") === flag(source, "storedA") &&
        flag(target, "storedB") === flag(source, "storedB") &&
        text(target, "phase") === text(source, "phase") &&
        text(target, "runId") === text(source, "runId") &&
        text(target, "readId") === text(source, "readId")
      if (!held) failures.push(`structure ${where} did not fence the read`)
      else replayed += 1
      continue
    }
    if (decision.decision !== "apply") {
      failures.push(`structure ${where} refused ${decision.code}`)
      continue
    }
    const actual = structurePicture(decision.register)
    const expected = {
      nodes: nodeNames(flag(target, "nodeA"), flag(target, "nodeB")),
      readNodes: flag(target, "didRead") ? nodeNames(flag(target, "storedA"), flag(target, "storedB")) : null,
      phase: phaseOf(target),
      runId: text(target, "runId"),
      personBefore: num(target, "personBefore"),
      personAfter: num(target, "personAfter"),
      agent: num(target, "agent"),
    }
    if (!flag(source, "didRead") && edge.action !== "SecondRunReads") expected.readNodes = null
    if (!same(actual, expected)) {
      failures.push(`structure ${where}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`)
    } else replayed += 1
  }
  return { replayed, stuttered: 0 }
}

function runRegister(spec: Spec): Register {
  const rows: NodeRegister["landed"][number][] = []
  if (num(spec, "writes") === 1) rows.push({ actor: "agent", value: "agent", visible: true })
  const stored = text(spec, "runId")
  return {
    ...openRegister("floor", "slide"),
    landed: rows,
    phase: phaseOf(spec),
    runId: stored === "none" ? null : stored,
    readAt: num(spec, "readAt") === -1 ? null : num(spec, "readAt"),
    guarded: false,
    stoppedAt: num(spec, "mark") === -1 ? null : num(spec, "mark"),
    readNodes: flag(spec, "didRead") ? ["a"] : null,
  }
}

function runPicture(register: Register) {
  return {
    phase: register.phase,
    runId: register.runId ?? "none",
    writes: register.landed.filter((row) => row.visible && row.actor === "agent").length,
    readAt: register.readAt ?? -1,
    mark: register.stoppedAt ?? -1,
    didRead: register.readNodes !== null,
  }
}

function runExpected(spec: Spec) {
  return {
    phase: phaseOf(spec),
    runId: text(spec, "runId"),
    writes: num(spec, "writes"),
    readAt: num(spec, "readAt"),
    mark: num(spec, "mark"),
    didRead: flag(spec, "didRead"),
  }
}

function otherRun(id: string): string {
  if (id === "s") return "t"
  if (id === "t") return "s"
  throw new Error(`bad run ${id}`)
}

function offeredRead(action: string): string | null {
  if (action === "ReadS") return "s"
  if (action === "ReadT") return "t"
  return null
}

function replayRun(graph: Graph, view: View, failures: string[]) {
  let replayed = 0
  const unconnected: Record<string, number> = { Resume: 0, Limit: 0 }
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing run state for ${edge.action}`)
    const where = `${readView(view, source, edge.action)} -${edge.action}-> ${readView(view, target, edge.action)}`
    if (edge.action === "Resume" || edge.action === "Limit") {
      unconnected[edge.action] += 1
      continue
    }
    const register = runRegister(source)
    const stored = text(source, "runId")
    const offer = offeredRead(edge.action)
    if (edge.action === "StartAgain") {
      const repeat = decide(register, { command: "start", runId: stored })
      const other = decide(register, { command: "start", runId: otherRun(stored) })
      const held =
        repeat.decision === "refuse" &&
        repeat.code === "run-fenced" &&
        other.decision === "refuse" &&
        other.code === "run-fenced" &&
        same(runExpected(source), runExpected(target))
      if (!held) failures.push(`run ${where} replaced the stored run`)
      else replayed += 1
      continue
    }
    const refused =
      edge.action === "StopMiss" ||
      edge.action === "AgentMiss" ||
      (edge.action === "AgentWrites" && text(source, "phase") !== "running") ||
      (offer !== null && !(flag(target, "didRead") && !flag(source, "didRead")))
    const decision =
      edge.action === "Start"
        ? decide(register, { command: "start", runId: text(target, "runId") })
        : edge.action === "Stop"
          ? decide(register, { command: "stop", runId: stored })
          : edge.action === "StopMiss"
            ? decide(register, { command: "stop", runId: otherRun(stored) })
            : edge.action === "AgentWrites" || edge.action === "AgentMiss"
              ? decide(register, {
                  command: "agent",
                  runId: edge.action === "AgentMiss" ? otherRun(stored) : stored,
                  readAt: num(source, "readAt"),
                  value: "agent",
                })
              : edge.action === "Undo"
                ? decide(register, { command: "undo", runId: stored })
                : offer !== null
                  ? decide(register, { command: "read", runId: offer, node: "a" })
                  : null
    if (decision === null) {
      failures.push(`run ${where} is not connected`)
      continue
    }
    if (refused) {
      const held =
        decision.decision === "refuse" &&
        decision.code === "run-fenced" &&
        same(runExpected(source), runExpected(target))
      if (!held) failures.push(`run ${where} did not fence the run`)
      else replayed += 1
      continue
    }
    if (decision.decision !== "apply") {
      failures.push(`run ${where} refused ${decision.code}`)
      continue
    }
    const actual = runPicture(decision.register)
    const expected = runExpected(target)
    if (!same(actual, expected)) {
      failures.push(`run ${where}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`)
    } else replayed += 1
  }
  return { replayed, stuttered: 0, unconnected }
}

function queueOf(spec: Spec): Queued[] {
  const queue: Queued[] = []
  if (flag(spec, "queued1")) queue.push({ base: 0, value: "one" })
  if (flag(spec, "queued2")) queue.push({ base: 1, value: "two" })
  if (flag(spec, "stale")) queue.push({ base: 0, value: "stale" })
  return queue
}

function ackOf(spec: Spec): number {
  return flag(spec, "acked1") ? 1 : 0
}

function offlineRegister(spec: Spec): Register {
  let register = openRegister("floor", "slide")
  const values: string[] = []
  if (flag(spec, "landed1")) values.push("one")
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
  if (flag(spec, "landed1")) values.push("one")
  if (flag(spec, "landed2")) values.push("two")
  return values
}

function replayOffline(graph: Graph, view: View, failures: string[]) {
  let replayed = 0
  let stuttered = 0
  const unconnected: Record<string, number> = { Crash: 0, Wipe: 0, Undo: 0 }
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing offline state for ${edge.action}`)
    const where = `${readView(view, source, edge.action)} -${edge.action}-> ${readView(view, target, edge.action)}`
    if (edge.action === "Crash" || edge.action === "Wipe" || edge.action === "Undo") {
      unconnected[edge.action] += 1
      continue
    }
    if (edge.action === "Rest") {
      const changed = changedKeys(source, target, [])
      if (changed.length > 0) failures.push(`offline stutter ${where} changed ${changed.join(", ")}`)
      else stuttered += 1
      continue
    }
    const pending = unsent(queueOf(source), ackOf(source))
    const later = unsent(queueOf(target), ackOf(target))
    if (edge.action === "QueueFirst" || edge.action === "QueueSecond" || edge.action === "QueueStale") {
      const wanted = edge.action === "QueueFirst" ? "one" : edge.action === "QueueSecond" ? "two" : "stale"
      if (gained(pending, later) !== wanted) failures.push(`offline ${where} did not append an unsent edit`)
      else replayed += 1
      continue
    }
    if (edge.action === "Send") {
      if (pending[0]?.value !== "one" || !same(later, pending)) failures.push(`offline ${where} sent out of order`)
      else replayed += 1
      continue
    }
    if (edge.action === "SendNext") {
      const first = pending.findIndex((item) => item.value === "one")
      const second = pending.findIndex((item) => item.value === "two")
      const ordered =
        second >= 0 && !(first !== -1 && first < second && flag(source, "sent1") === false) && same(later, pending)
      if (!ordered) failures.push(`offline ${where} sent the second edit first`)
      else replayed += 1
      continue
    }
    if (edge.action === "Ack") {
      if (!same(later, pending.slice(1))) failures.push(`offline ${where} acknowledged out of order`)
      else replayed += 1
      continue
    }
    if (edge.action === "Land" || edge.action === "LandNext" || edge.action === "Skip" || edge.action === "LandStale") {
      const picked =
        edge.action === "Land"
          ? pending.filter((item) => item.value === "one").slice(0, 1)
          : edge.action === "LandNext"
            ? pending.filter((item) => item.value === "two").slice(0, 1)
            : pending.filter((item) => item.value === "stale")
      const next = replay(offlineRegister(source), picked)
      const actual = { version: version(next), history: history(next) }
      const expected = { version: num(target, "version"), history: landedHistory(target) }
      if (!same(actual, expected)) {
        failures.push(`offline ${where}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`)
      } else replayed += 1
      continue
    }
    failures.push(`offline ${where} is not connected`)
  }
  return { replayed, stuttered, unconnected }
}

const halfTokens = 100_000
const allTokens = 200_000

function usageLedger(spec: Spec): Ledger {
  const turn = text(spec, "turn")
  return {
    spent: num(spec, "spent"),
    hold: num(spec, "hold"),
    turn: turn === "none" ? null : turn,
    week: num(spec, "week"),
    outside: num(spec, "outside"),
  }
}

function usagePicture(ledger: Ledger) {
  return {
    spent: ledger.spent,
    hold: ledger.hold,
    turn: ledger.turn === null ? "none" : ledger.turn,
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
  const settle = (id: string, output: number, search: number, searchOn: boolean, usOnly: boolean): Command => ({
    command: "settle",
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
  if (action === "Release" || action === "ReleaseClosed") return { command: "release", id: "a" }
  if (action === "ReleaseOther") return { command: "release", id: "b" }
  if (action === "Monday") return { command: "monday" }
  if (action === "Outside") return { command: "outside" }
  return null
}

function replayUsage(graph: Graph, view: View, failures: string[]) {
  let replayed = 0
  let stuttered = 0
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing usage state for ${edge.action}`)
    const where = `${readView(view, source, edge.action)} -${edge.action}-> ${readView(view, target, edge.action)}`
    const command = usageCommand(edge.action)
    if (!command) {
      failures.push(`usage ${where} is not connected`)
      continue
    }
    const result = usage(usageLedger(source), command)
    const actual = usagePicture(result.ledger)
    const expected = usagePicture(usageLedger(target))
    if (!same(actual, expected)) {
      failures.push(`usage ${where}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`)
      continue
    }
    const changed = !same(usagePicture(usageLedger(source)), expected)
    if (changed !== result.accepted) {
      failures.push(`usage ${where} accepted ${String(result.accepted)}`)
      continue
    }
    if (changed) replayed += 1
    else stuttered += 1
  }
  return { replayed, stuttered }
}

function dumpTopics(
  found: readonly { name: string; topic: string; spec: string; config: string }[],
): Promise<readonly { name: string; graph: string; output: string }[]> {
  const specifier = new URL("../scripts/check-specs.mjs", import.meta.url).href
  return Promise.all(
    found.map(
      (topic) =>
        new Promise<{ name: string; graph: string; output: string }>((resolve, reject) => {
          const child = spawn(process.execPath, ["--input-type=module"], { stdio: ["pipe", "pipe", "pipe"] })
          let out = ""
          let err = ""
          child.stdout.setEncoding("utf8")
          child.stderr.setEncoding("utf8")
          child.stdout.on("data", (chunk: string) => {
            out += chunk
          })
          child.stderr.on("data", (chunk: string) => {
            err += chunk
          })
          child.on("error", reject)
          child.on("close", (code) => {
            if (code !== 0) {
              reject(new Error(`${topic.name} ${err || out}`))
              return
            }
            const parsed = JSON.parse(out) as { graph: string; output: string }
            resolve({ name: topic.name, graph: parsed.graph, output: parsed.output })
          })
          child.stdin.end(
            `import { dumpSpec, javaBin, jarPath } from ${JSON.stringify(specifier)}\nconst dumped = dumpSpec(${JSON.stringify(topic.topic)}, javaBin(), jarPath(), ${JSON.stringify(topic.spec)}, ${JSON.stringify(topic.config)})\nprocess.stdout.write(JSON.stringify({ graph: dumped.graph, output: dumped.output }))\n`,
          )
        }),
    ),
  )
}

describe("spec replay", () => {
  it("replays every reachable spec edge through decide", async () => {
    assertJar(jarPath())
    const found = topics(root)
    {
      const found = topics(root).filter((topic) => topic.name !== "run")
      const usageAside = found.findIndex((topic) => topic.name === "usage")
      if (usageAside >= 0) found.splice(usageAside, 1)
      new Function(
        "found",
        "expect",
        `
    expect(found.map((topic) => topic.name).sort()).toEqual(["edit", "offline", "structure", "undo"])
`,
      )(found, expect)
    }
    const usageTopic = found.find((topic) => topic.name === "usage")
    if (usageTopic !== undefined) found.splice(found.indexOf(usageTopic), 1)
    expect(found.map((topic) => topic.name).sort()).toEqual(["edit", "offline", "run", "structure", "undo"])
    if (usageTopic !== undefined) found.push(usageTopic)
    expect(found.map((topic) => topic.name).sort()).toEqual(["edit", "offline", "run", "structure", "undo", "usage"])
    for (const topic of found) expect(topic.view).toBe(true)
    const failures: string[] = []
    const reports: Record<string, unknown> = {}
    const views: Record<string, View> = {
      edit: { state: editState, step: editStep, group: editGroup },
      undo: { state: undoState, step: undoStep, group: undoGroup },
      structure: { state: structureState, step: structureStep, group: structureGroup },
      run: { state: runState, step: runStep, group: runGroup },
      offline: { state: offlineState, step: offlineStep, group: offlineGroup },
      usage: { state: usageState, step: usageStep, group: usageGroup },
    }
    for (const dumped of await dumpTopics(found)) {
      const topic = found.find((item) => item.name === dumped.name)
      if (!topic) throw new Error(dumped.name)
      if (!dumped.graph.includes("label=")) {
        failures.push(`${topic.name} dumped no graph\n${dumped.output.slice(-500)}`)
        continue
      }
      const graph = parseDot(dumped.graph)
      const view = views[topic.name]
      if (!view) throw new Error(`${topic.name} has no reader`)
      if (topic.name === "edit")
        reports.edit = { states: graph.states.size, edges: graph.edges.length, ...replayEdit(graph, view, failures) }
      if (topic.name === "undo")
        reports.undo = { states: graph.states.size, edges: graph.edges.length, ...replayUndo(graph, view, failures) }
      if (topic.name === "structure") {
        reports.structure = {
          states: graph.states.size,
          edges: graph.edges.length,
          ...replayStructure(graph, view, failures),
        }
      }
      if (topic.name === "run") {
        reports.run = {
          states: graph.states.size,
          edges: graph.edges.length,
          ...replayRun(graph, view, failures),
        }
      }
      if (topic.name === "offline") {
        reports.offline = {
          states: graph.states.size,
          edges: graph.edges.length,
          ...replayOffline(graph, view, failures),
        }
      }
      if (topic.name === "usage") {
        reports.usage = {
          states: graph.states.size,
          edges: graph.edges.length,
          ...replayUsage(graph, view, failures),
        }
      }
    }
    expect(failures, JSON.stringify(reports)).toEqual([])
    expect(reports).toMatchObject({
      edit: { stuttered: expect.any(Number) },
      undo: { stuttered: expect.any(Number) },
      structure: { replayed: expect.any(Number) },
      run: { unconnected: { Resume: expect.any(Number), Limit: expect.any(Number) } },
      offline: { unconnected: { Crash: expect.any(Number), Wipe: expect.any(Number), Undo: 0 } },
      usage: { replayed: expect.any(Number), stuttered: expect.any(Number) },
    })
    const runReport = reports.run as { unconnected: { Resume: number; Limit: number } }
    expect(runReport.unconnected.Resume).toBeGreaterThan(0)
    expect(runReport.unconnected.Limit).toBeGreaterThan(0)
  }, 60_000)
})
