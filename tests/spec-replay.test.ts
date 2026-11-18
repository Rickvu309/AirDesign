import { parseDot, type Graph } from "./spec-graph.js"
import { replayElement } from "./element-replay.js"
import * as elementView from "../specs/element/view.mjs"
import { opened, viewed, personSplit, storedRoot, traitRow } from "./spec-register.js"
import { dumpTopics } from "./spec-dump.js"
import { replayIndex } from "./index-replay.js"
import { replayUsage } from "./usage-replay.js"
import { replayOffline } from "./offline-replay.js"
import { replayOauth } from "./oauth-replay.js"
import { replayPersonUndo } from "./person-undo-replay.js"
import { replayStructure } from "./structure-replay.js"
import { flag, num, phaseOf, text } from "./spec-values.js"
import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  compactChain,
  decide,
  decideUndo,
  history,
  replay,
  unsent,
  version,
  type NodeName,
  type NodeRegister,
  type Phase,
  type Queued,
  type Register,
} from "@airdesign/document"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import { group as editGroup, state as editState, step as editStep } from "../specs/edit/view.mjs"
import { group as offlineGroup, state as offlineState, step as offlineStep } from "../specs/offline/view.mjs"
import { group as runGroup, state as runState, step as runStep } from "../specs/run/view.mjs"
import { group as structureGroup, state as structureState, step as structureStep } from "../specs/structure/view.mjs"
import { group as undoGroup, state as undoState, step as undoStep } from "../specs/undo/view.mjs"
import * as usageView from "../specs/usage/view.mjs"
import { group as oauthGroup, state as oauthState, step as oauthStep } from "../specs/oauth/view.mjs"
import { group as rerunGroup, state as rerunState, step as rerunStep } from "../specs/rerun/view.mjs"
import * as turnView from "../specs/turn/view.mjs"
import { group as indexGroup, state as indexState, step as indexStep } from "../specs/index/view.mjs"
import * as personUndoView from "../specs/person-undo/view.mjs"

type Value = boolean | number | string
type Spec = Record<string, Value>
type View = {
  state: (spec: Spec) => string
  step: (action: string, spec: Spec) => string | null
  group: (spec: Spec) => string
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const run = "r"

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

function editVersion(spec: Spec): number {
  return num(spec, "personBefore") + num(spec, "personAfter") + num(spec, "agent") + 2 * num(spec, "hidden")
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
  for (const row of landed) {
    if (row.actor === "agent") Object.assign(row, { runId: run })
  }
  const phase = phaseOf(spec)
  return storedRoot({
    landed,
    version: editVersion(spec),
    phase,
    runId: phase === "idle" ? null : run,
    readAt: num(spec, "readAt") === -1 ? null : num(spec, "readAt"),
    guarded: flag(spec, "guarded"),
    claimed: num(spec, "claims") === -1 ? null : num(spec, "claims"),
    stoppedAt: num(spec, "stoppedAt") === -1 ? null : num(spec, "stoppedAt"),
  })
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
    version: editVersion(spec),
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
        ...traitRow,
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
      for (const probe of [0, 1, 2, 3, 4]) {
        const probed = decide(register, { command: "agent", runId: run, readAt: probe, ...traitRow })
        if (probed.decision !== "refuse" || probed.code !== "person-protected") {
          failures.push(`edit ${where} did not refuse readAt ${probe} as person-protected`)
        }
      }
      if (decision.decision !== "refuse" || decision.code !== "person-protected") {
        failures.push(`edit ${where} accepted the read after a person`)
      } else replayed += 1
    } else {
      failures.push(`edit ${where} is not connected`)
      continue
    }
    if (next) {
      const actual = editPicture(opened(next), positional)
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
  for (const row of landed) {
    if (row.actor === "agent") Object.assign(row, { runId: run })
  }
  const people = landed.filter((row) => row.visible && row.actor === "person").length
  return storedRoot({
    landed,
    version: undoVersion(spec),
    phase: undoPhase(spec),
    runId: run,
    readAt: people,
    guarded: false,
  })
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

function undoVersion(spec: Spec): number {
  const hidden = num(spec, "hidden") + num(spec, "laterHidden") + (flag(spec, "dropped") ? 1 : 0)
  return num(spec, "person") + num(spec, "agent") + num(spec, "later") + 2 * hidden
}

function laterPhase(spec: Spec): Phase {
  const track = text(spec, "track")
  if (track === "bothGone") return "undone"
  if (track === "second") return "running"
  if (track === "old") return undoPhase(spec)
  return "stopped"
}

function laterRunId(spec: Spec): string {
  const track = text(spec, "track")
  if (track === "second" || track === "secondStopped" || track === "firstGone" || track === "bothGone") return "s"
  return run
}

function laterRegister(spec: Spec): Register {
  const landed: NodeRegister["landed"][number][] = []
  if (num(spec, "person") === 1) landed.push({ actor: "person", value: "person", visible: true })
  if (num(spec, "agent") === 1 || num(spec, "hidden") === 1) {
    landed.push({ actor: "agent", value: "agent", visible: num(spec, "agent") === 1, runId: run })
  }
  if (num(spec, "later") === 1 || num(spec, "laterHidden") === 1) {
    landed.push({ actor: "agent", value: "later", visible: num(spec, "later") === 1, runId: "s" })
  }
  return storedRoot({
    landed,
    version: undoVersion(spec),
    phase: laterPhase(spec),
    runId: laterRunId(spec),
    readAt: landed.filter((row) => row.visible).length,
    guarded: false,
  })
}

function laterPicture(register: Register) {
  let person = 0
  let first = 0
  let firstHidden = 0
  let later = 0
  let laterHidden = 0
  for (const row of register.landed) {
    if (row.actor === "person" && row.visible) person += 1
    if (row.actor === "agent" && row.runId === run && row.visible) first += 1
    if (row.actor === "agent" && row.runId === run && !row.visible) firstHidden += 1
    if (row.actor === "agent" && row.runId === "s" && row.visible) later += 1
    if (row.actor === "agent" && row.runId === "s" && !row.visible) laterHidden += 1
  }
  return { phase: register.phase, runId: register.runId, person, first, firstHidden, later, laterHidden }
}

function laterExpected(spec: Spec) {
  return {
    phase: laterPhase(spec),
    runId: laterRunId(spec),
    person: num(spec, "person"),
    first: num(spec, "agent"),
    firstHidden: num(spec, "hidden"),
    later: num(spec, "later"),
    laterHidden: num(spec, "laterHidden"),
  }
}

function undoHider(action: string): string | null {
  if (action === "UndoFirst") return "firstUndo"
  if (action === "UndoSecond") return "laterUndo"
  if (action === "UndoFirstAgain" || action === "UndoLaterAgain") return "secondUndo"
  return null
}

function undoStepped(action: string, source: Spec, register: Register): NodeRegister | null {
  if (action === "Compact") return compactChain(register, flag(source, "eligible"))
  const decision =
    action === "PersonWrites"
      ? decide(register, { command: "person", value: "person" })
      : action === "AgentWrites"
        ? decide(register, { command: "agent", runId: run, readAt: version(register), value: "agent" })
        : action === "Undo"
          ? decide(register, { command: "undo", runId: run })
          : null
  return decision?.decision === "apply" ? opened(decision.register) : null
}

function replayUndo(graph: Graph, view: View, failures: string[]) {
  let replayed = 0
  let stuttered = 0
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing undo state for ${edge.action}`)
    const where = `${readView(view, source, edge.action)} -${edge.action}-> ${readView(view, target, edge.action)}`
    if (
      edge.action === "StopFirst" ||
      edge.action === "StartSecond" ||
      edge.action === "LaterWrites" ||
      edge.action === "UndoFirstLive" ||
      edge.action === "StopSecond" ||
      edge.action === "UndoFirst" ||
      edge.action === "UndoSecond" ||
      edge.action === "UndoFirstAgain" ||
      edge.action === "UndoLaterAgain"
    ) {
      const register = laterRegister(source)
      const stutter =
        edge.action === "UndoFirstLive" || edge.action === "UndoFirstAgain" || edge.action === "UndoLaterAgain"
      const decision =
        edge.action === "StopFirst"
          ? decide(register, { command: "stop", runId: run })
          : edge.action === "StartSecond"
            ? decide(register, { command: "start", runId: "s" })
            : edge.action === "LaterWrites"
              ? decide(register, { command: "agent", runId: "s", readAt: version(register), ...traitRow })
              : edge.action === "StopSecond"
                ? decide(register, { command: "stop", runId: "s" })
                : edge.action === "UndoSecond" || edge.action === "UndoLaterAgain"
                  ? decide(register, { command: "undo", runId: "s" })
                  : decide(register, { command: "undo", runId: run })
      if (stutter) {
        const held =
          decision.decision === "refuse" &&
          decision.code === "run-fenced" &&
          text(source, "hiddenBy") === text(target, "hiddenBy") &&
          same(laterExpected(source), laterExpected(target))
        if (!held) failures.push(`undo ${where} changed the other run`)
        else replayed += 1
        continue
      }
      if (decision.decision !== "apply") {
        failures.push(`undo ${where} refused ${decision.code}`)
        continue
      }
      const actual = laterPicture(opened(decision.register))
      const expected = laterExpected(target)
      if (version(opened(decision.register)) !== undoVersion(target)) {
        failures.push(`undo ${where} version ${version(opened(decision.register))} expected ${undoVersion(target)}`)
      }
      if (actual.laterHidden > num(source, "laterHidden") && text(target, "hiddenBy") !== undoHider(edge.action)) {
        failures.push(`undo ${where} hid the later row with the wrong undo`)
      }
      if (edge.action === "UndoFirst" && flag(target, "firstLive") !== (laterPhase(source) === "running")) {
        failures.push(`undo ${where} recorded the wrong phase for the earlier undo`)
      }
      if (!same(actual, expected)) {
        failures.push(`undo ${where}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`)
      } else replayed += 1
      continue
    }
    if (edge.action === "Done") {
      const changed = changedKeys(source, target, [])
      if (changed.length > 0) failures.push(`undo stutter ${where} changed ${changed.join(", ")}`)
      else stuttered += 1
      continue
    }
    const register = undoRegister(source)
    const stepped = undoStepped(edge.action, source, register)
    if (stepped !== null && version(stepped) !== undoVersion(target)) {
      failures.push(`undo ${where} version ${version(stepped)} expected ${undoVersion(target)}`)
    }
    let picture: ReturnType<typeof undoPicture> | null = null
    if (edge.action === "PersonWrites") {
      const decision = decide(register, { command: "person", value: "person" })
      if (decision.decision !== "apply") failures.push(`undo ${where} refused ${decision.code}`)
      else picture = undoPicture(opened(decision.register))
    } else if (edge.action === "AgentWrites") {
      const decision = decide(register, {
        command: "agent",
        runId: run,
        readAt: version(register),
        value: "agent",
      })
      if (decision.decision !== "apply") failures.push(`undo ${where} refused ${decision.code}`)
      else picture = undoPicture(opened(decision.register))
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

function runRegister(spec: Spec): Register {
  const rows: NodeRegister["landed"][number][] = []
  if (num(spec, "writes") === 1) rows.push({ actor: "agent", value: "agent", visible: true })
  if (num(spec, "landed") === 1 && num(spec, "writes") === 0) {
    rows.push({ actor: "agent", value: "agent", visible: false })
  }
  const stored = text(spec, "runId")
  const owner = text(spec, "owner")
  const tag = owner === "none" ? stored : owner
  if (tag !== "none") {
    for (const row of rows) Object.assign(row, { runId: tag })
  }
  return storedRoot({
    landed: rows,
    phase: phaseOf(spec),
    runId: stored === "none" ? null : stored,
    readAt: num(spec, "readAt") === -1 ? null : num(spec, "readAt"),
    guarded: false,
    stoppedAt: num(spec, "mark") === -1 ? null : num(spec, "mark"),
    readNodes: flag(spec, "didRead") ? ["a"] : null,
  })
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
    if (edge.action === "Start" || edge.action === "StartNext") {
      if (flag(target, "startedLive") !== (text(source, "phase") === "running")) {
        failures.push(`run ${where} recorded the wrong phase for the start`)
      }
      const started = decide(runRegister(source), { command: "start", runId: text(target, "runId") })
      if (started.decision !== "apply" || opened(started.register).runId !== text(target, "liveId")) {
        failures.push(`run ${where} did not start the live id`)
      }
    }
    if (edge.action === "UndoEarlier" && flag(target, "earlierLive") !== (text(source, "phase") === "running")) {
      failures.push(`run ${where} recorded the wrong phase for the earlier undo`)
    }
    if (edge.action === "Resume" || edge.action === "Limit") {
      unconnected[edge.action] += 1
      continue
    }
    const register = runRegister(source)
    const stored = text(source, "runId")
    const offer = offeredRead(edge.action)
    if (edge.action === "StartNext") {
      const decision = decide(register, { command: "start", runId: text(target, "runId") })
      const owner = text(source, "owner")
      const visible =
        decision.decision === "apply"
          ? opened(decision.register).landed.filter((row) => row.actor === "agent" && row.visible)
          : []
      const owned = owner === "none" ? visible.length === 0 : visible.every((row) => row.runId === owner)
      const held =
        decision.decision === "apply" &&
        owned &&
        opened(decision.register).guarded === false &&
        opened(decision.register).claimed === null &&
        same(runPicture(viewed(decision.register)), runExpected(target))
      if (!held) failures.push(`run ${where} did not open the next run`)
      else replayed += 1
      continue
    }
    if (edge.action === "StartReuse") {
      const decision = decide(register, { command: "start", runId: text(source, "owner") })
      const held =
        decision.decision === "refuse" &&
        decision.code === "run-fenced" &&
        same(runExpected(source), runExpected(target))
      if (!held) failures.push(`run ${where} reused a run that already has a row`)
      else replayed += 1
      continue
    }
    if (edge.action === "UndoEarlier") {
      const decision = decide(register, { command: "undo", runId: text(source, "owner") })
      const hidden =
        decision.decision === "apply" &&
        opened(decision.register).landed.some(
          (row) => row.actor === "agent" && row.runId === text(source, "owner") && !row.visible,
        )
      const held =
        decision.decision === "apply" &&
        hidden &&
        opened(decision.register).phase === text(source, "phase") &&
        opened(decision.register).runId === stored &&
        same(runPicture(viewed(decision.register)), runExpected(target))
      if (!held) failures.push(`run ${where} hid the later run`)
      else replayed += 1
      continue
    }
    if (edge.action === "UndoEarlierLive" || edge.action === "UndoEarlierAgain") {
      const decision = decide(register, { command: "undo", runId: text(source, "owner") })
      const held =
        decision.decision === "refuse" &&
        decision.code === "run-fenced" &&
        same(runExpected(source), runExpected(target))
      if (!held) failures.push(`run ${where} undid the earlier run`)
      else replayed += 1
      continue
    }
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
                  ...traitRow,
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
    const actual = runPicture(viewed(decision.register))
    const expected = runExpected(target)
    if (!same(actual, expected)) {
      failures.push(`run ${where}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`)
    } else replayed += 1
  }
  return { replayed, stuttered: 0, unconnected }
}

const secondRun = "s"

function rerunVersion(spec: Spec): number {
  const shown = num(spec, "firstRows") + num(spec, "person") + num(spec, "secondRows") + num(spec, "secondPerson")
  return shown + 2 * num(spec, "hidden")
}

function rerunRegister(spec: Spec): Register {
  const landed: NodeRegister["landed"][number][] = []
  if (flag(spec, "firstLanded")) {
    landed.push({ actor: "agent", value: "first", visible: num(spec, "firstRows") === 1, runId: run })
  }
  for (let index = 0; index < num(spec, "person"); index += 1) {
    landed.push({ actor: "person", value: "person", visible: true })
  }
  for (let index = 0; index < num(spec, "secondRows"); index += 1) {
    landed.push({ actor: "agent", value: "second", visible: true, runId: secondRun })
  }
  for (let index = 0; index < num(spec, "secondPerson"); index += 1) {
    landed.push({ actor: "person", value: "during", visible: true })
  }
  const phase = phaseOf(spec)
  return storedRoot({
    landed,
    version: rerunVersion(spec),
    phase,
    runId: phase === "idle" ? null : num(spec, "run") === 2 ? secondRun : run,
    readAt: num(spec, "readAt") === -1 ? null : num(spec, "readAt"),
    guarded: flag(spec, "guarded"),
    claimed: num(spec, "claims") === -1 ? null : num(spec, "claims"),
    stoppedAt: num(spec, "stoppedAt") === -1 ? null : num(spec, "stoppedAt"),
  })
}

function rerunPicture(register: Register) {
  return {
    phase: register.phase,
    runId: register.runId ?? "none",
    version: version(register),
    readAt: register.readAt ?? -1,
    guarded: register.guarded,
    claims: register.claimed ?? -1,
    stoppedAt: register.stoppedAt ?? -1,
    firstRows: register.landed.filter((row) => row.visible && row.actor === "agent" && row.runId === run).length,
    secondRows: register.landed.filter((row) => row.visible && row.actor === "agent" && row.runId === secondRun).length,
    people: register.landed.filter((row) => row.visible && row.actor === "person").length,
  }
}

function rerunExpected(spec: Spec) {
  const phase = phaseOf(spec)
  return {
    phase,
    runId: phase === "idle" ? "none" : num(spec, "run") === 2 ? secondRun : run,
    version: rerunVersion(spec),
    readAt: num(spec, "readAt"),
    guarded: flag(spec, "guarded"),
    claims: num(spec, "claims"),
    stoppedAt: num(spec, "stoppedAt"),
    firstRows: num(spec, "firstRows"),
    secondRows: num(spec, "secondRows"),
    people: num(spec, "person") + num(spec, "secondPerson"),
  }
}

function rerunWrite(spec: Spec, value: string) {
  return {
    command: "agent" as const,
    runId: num(spec, "run") === 2 ? secondRun : run,
    readAt: num(spec, "readAt"),
    value,
  }
}

function rerunDecision(edge: { action: string }, source: Spec, register: Register) {
  const current = num(source, "run") === 2 ? secondRun : run
  if (edge.action === "PersonWrites" || edge.action === "PersonWritesSecond") {
    return decide(register, { command: "person", value: "person" })
  }
  if (edge.action === "RunStarts") return decide(register, { command: "start", runId: run })
  if (edge.action === "StartNext") return decide(register, { command: "start", runId: secondRun })
  if (edge.action === "RunStops") return decide(register, { command: "stop", runId: current })
  if (edge.action === "RunUndoes") return decide(register, { command: "undo", runId: run })
  if (edge.action === "SecondUndoes") return decide(register, { command: "undo", runId: secondRun })
  if (
    edge.action === "FirstWrites" ||
    edge.action === "SecondWrites" ||
    edge.action === "SecondWritesAgain" ||
    edge.action === "SecondKeepsClaim" ||
    edge.action === "SecondRefusesProtected"
  ) {
    return decide(register, rerunWrite(source, "row"))
  }
  return null
}

function replayRerun(graph: Graph, view: View, failures: string[]) {
  let replayed = 0
  let stuttered = 0
  for (const edge of graph.edges) {
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing rerun state for ${edge.action}`)
    const where = `${readView(view, source, edge.action)} -${edge.action}-> ${readView(view, target, edge.action)}`
    if (text(source, "phase") === "stopped") {
      const late = decide(rerunRegister(source), rerunWrite(source, "late"))
      if (late.decision !== "refuse" || late.code !== "run-fenced") {
        failures.push(`rerun ${where} landed a write of a stopped run`)
      }
    }
    if (edge.action === "Done" || edge.action === "AgentRereads") {
      const changed = changedKeys(source, target, edge.action === "AgentRereads" ? ["readAt"] : [])
      if (changed.length > 0) failures.push(`rerun stutter ${where} changed ${changed.join(", ")}`)
      else stuttered += 1
      continue
    }
    const decision = rerunDecision(edge, source, rerunRegister(source))
    if (decision === null) {
      failures.push(`rerun ${where} is not connected`)
      continue
    }
    if (edge.action === "SecondRefusesProtected") {
      const held =
        decision.decision === "refuse" &&
        decision.code === "person-protected" &&
        same(rerunExpected(source), rerunExpected(target))
      for (const probe of [0, 1, 2, 3, 4, 5]) {
        const probed = decide(rerunRegister(source), { ...rerunWrite(source, "row"), readAt: probe })
        if (probed.decision !== "refuse" || probed.code !== "person-protected") {
          failures.push(`rerun ${where} did not refuse readAt ${probe} as person-protected`)
        }
      }
      if (!held) failures.push(`rerun ${where} landed after a person edit`)
      else replayed += 1
      continue
    }
    if (decision.decision !== "apply") {
      failures.push(`rerun ${where} refused ${decision.code}`)
      continue
    }
    const actual = rerunPicture(opened(decision.register))
    const expected = rerunExpected(target)
    if (!same(actual, expected)) {
      failures.push(`rerun ${where}\n  actual ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`)
    } else replayed += 1
  }
  return { replayed, stuttered }
}

describe("spec replay", () => {
  it("replays every spec edge through decide", async () => {
    assertJar(jarPath())
    const every = topics(root)
    const folders = readdirSync(path.join(root, "specs"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    expect(every.map((topic) => topic.name).sort()).toEqual(folders)
    for (const topic of every) expect(topic.view).toBe(true)
    const failures: string[] = []
    const reports: Record<string, unknown> = {}
    const views: Record<string, View> = {
      edit: { state: editState, step: editStep, group: editGroup },
      undo: { state: undoState, step: undoStep, group: undoGroup },
      structure: { state: structureState, step: structureStep, group: structureGroup },
      run: { state: runState, step: runStep, group: runGroup },
      offline: { state: offlineState, step: offlineStep, group: offlineGroup },
      usage: usageView,
      oauth: { state: oauthState, step: oauthStep, group: oauthGroup },
      rerun: { state: rerunState, step: rerunStep, group: rerunGroup },
      turn: turnView,
      element: elementView,
      index: { state: indexState, step: indexStep, group: indexGroup },
      "person-undo": personUndoView,
    }
    const found = every.filter((topic) => topic.name in views)
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
      const told = (source: Spec, target: Spec, action: string) =>
        `${readView(view, source, action)} -${action}-> ${readView(view, target, action)}`
      if (topic.name === "element") reports.element = replayElement(graph, failures)
      if (topic.name === "index") reports.index = replayIndex(graph, failures)
      if (topic.name === "person-undo") reports.personUndo = replayPersonUndo(graph, told, failures)
      if (topic.name === "edit")
        reports.edit = { states: graph.states.size, edges: graph.edges.length, ...replayEdit(graph, view, failures) }
      if (topic.name === "undo")
        reports.undo = { states: graph.states.size, edges: graph.edges.length, ...replayUndo(graph, view, failures) }
      if (topic.name === "structure") {
        reports.structure = {
          states: graph.states.size,
          edges: graph.edges.length,
          ...replayStructure(graph, told, failures),
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
          ...replayOffline(graph, told, failures),
        }
      }
      if (topic.name === "usage") {
        reports.usage = {
          states: graph.states.size,
          edges: graph.edges.length,
          ...replayUsage(graph, told, failures),
        }
      }
      if (topic.name === "oauth") {
        reports.oauth = {
          states: graph.states.size,
          edges: graph.edges.length,
          ...replayOauth(graph, told, failures),
        }
      }
      if (topic.name === "rerun") {
        reports.rerun = {
          states: graph.states.size,
          edges: graph.edges.length,
          ...replayRerun(graph, view, failures),
        }
      }
    }
    expect(failures, JSON.stringify(reports)).toEqual([])
    expect(reports).toMatchObject({
      index: { replayed: expect.any(Number), stuttered: expect.any(Number) },
      personUndo: { replayed: expect.any(Number), told: expect.any(Number) },
      edit: { stuttered: expect.any(Number) },
      undo: { stuttered: expect.any(Number) },
      structure: { replayed: expect.any(Number), grouped: expect.any(Number) },
      run: { unconnected: { Resume: expect.any(Number), Limit: expect.any(Number) } },
      offline: { unconnected: { Crash: expect.any(Number), Wipe: expect.any(Number), Undo: 0 } },
      usage: { replayed: expect.any(Number), stuttered: expect.any(Number) },
      oauth: { replayed: expect.any(Number), stuttered: expect.any(Number) },
      rerun: { replayed: expect.any(Number), stuttered: expect.any(Number) },
    })
    const runReport = reports.run as { unconnected: { Resume: number; Limit: number } }
    expect(runReport.unconnected.Resume).toBeGreaterThan(0)
    expect(runReport.unconnected.Limit).toBeGreaterThan(0)
    expect((reports.structure as { grouped: number }).grouped).toBeGreaterThan(40)
  }, 60_000)
})
