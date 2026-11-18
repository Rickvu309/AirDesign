import {
  decide,
  elementId,
  groupedNow,
  groupFormed,
  groupOf,
  legacyElement,
  madeGroup,
  openRegister,
  placeOf,
  rootElement,
  slideId,
  throughGroup,
  undoSlides,
  ungroupTurn,
  type Command,
  type IndexElement,
  type NodeName,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import type { Graph } from "./spec-graph.js"
import { viewed } from "./spec-register.js"
import { flag, num, phaseOf, text } from "./spec-values.js"

type Spec = Record<string, boolean | number | string>
type Told = (source: Spec, target: Spec, action: string) => string

const treeActions = [
  "GroupBy",
  "MoveGroup",
  "UndoMoveGroup",
  "MoveChild",
  "UndoMoveChild",
  "Ungroup",
  "Regroup",
  "RunUndo",
]

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
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
  const opened = openRegister("floor", "slide")
  const first = opened.elements[rootElement]
  if (first === undefined) throw new Error("missing first element")
  const body = { ...first, version: 0, phase, runId }
  return {
    ...opened,
    nodes,
    readNodes,
    elements: { [rootElement]: body, ...(flag(spec, "nodeB") ? { [legacyElement]: body } : {}) },
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

function replayNodes(graph: Graph, told: Told, failures: string[]): number {
  let replayed = 0
  for (const edge of graph.edges) {
    if (treeActions.includes(edge.action)) continue
    const source = graph.states.get(edge.from)
    const target = graph.states.get(edge.to)
    if (!source || !target) throw new Error(`missing structure state for ${edge.action}`)
    const where = told(source, target, edge.action)
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
    const actual = structurePicture(viewed(decision.register))
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
  return replayed
}

const slide = slideId("256")
const file = [slide]
const child = elementId("256.2")
const sibling = elementId("256.3")
const group = elementId("256.20")
const step = 1000
const elements: readonly IndexElement[] = [
  { node: child, kind: "shape", value: "", box: { x: step, y: 0, cx: 500, cy: 500 }, grouped: false },
  { node: sibling, kind: "shape", value: "", box: { x: 9000, y: 0, cx: 500, cy: 500 }, grouped: false },
]
const start: Register = {
  ...openRegister("", ""),
  index: {
    total: elements.length,
    slides: [{ id: "256", position: 0, free: 20 }],
    elements,
    pages: [{ once: "page", offset: 0, count: elements.length }],
  },
}

function ran(register: Register, commands: readonly Command[]): Register | null {
  let current = register
  for (const command of commands) {
    const node = command.command === "person" ? command.node : undefined
    if (node !== undefined && !current.nodes.includes(node)) {
      const opened = decide(current, { command: "add", node, floor: "", route: "" })
      if (opened.decision !== "apply") return null
      current = opened.register
    }
    const decision = decide(current, command)
    if (decision.decision !== "apply") return null
    current = decision.register
  }
  return current
}

function shifted(register: Register, node: typeof child, by: number): Register | null {
  const x = placeOf(register, node)?.box.x
  if (x === undefined) return null
  return ran(register, [{ command: "person", v: 1, patch: { box: { x: { set: x + by } } }, node }])
}

function slideCommand(edit: SlideCommand): Command {
  return { command: "slide", file, edit }
}

function treeStep(register: Register, action: string): Register | null | "refused" {
  if (action === "GroupPerson" || action === "GroupAgent") {
    const made = groupOf(register, slide, group, [child, sibling])
    if (made === null) return null
    return ran(register, [slideCommand(action === "GroupAgent" ? { ...made, runId: "run" } : made)])
  }
  if (action === "MoveGroup") return shifted(register, group, step)
  if (action === "UndoMoveGroup") return shifted(register, group, -step)
  if (action === "MoveChild") return shifted(register, child, step)
  if (action === "UndoMoveChild") return shifted(register, child, -step)
  if (action === "Ungroup") {
    const turn = ungroupTurn(register, file, slide, group)
    return turn === null ? null : ran(register, turn)
  }
  if (action === "Regroup") return ran(register, [slideCommand({ slide: "element-regroup", id: slide, node: group })])
  return undoSlides(register, "run") ?? "refused"
}

function shownOf(spec: Spec): number {
  return text(spec, "grouped") === "formed" ? num(spec, "inside") + num(spec, "offset") : num(spec, "own")
}

function slideX(register: Register): number | null {
  const own = placeOf(register, child)
  if (own === null || !groupedNow(register, child)) return own?.box.x ?? null
  const frame = madeGroup(register, group)?.element.box ?? null
  const outer = placeOf(register, group)
  return frame === null || outer === null ? null : throughGroup(own, outer, frame).box.x
}

function picture(register: Register) {
  return {
    formed: groupFormed(register, group),
    grouped: groupedNow(register, child),
    x: slideX(register),
  }
}

function quietStart(spec: Spec): boolean {
  return (
    text(spec, "groupKind") === "none" &&
    text(spec, "record") === "none" &&
    text(spec, "lastKind") === "none" &&
    text(spec, "phase") === "idle" &&
    text(spec, "runId") === "s" &&
    text(spec, "readId") === "s"
  )
}

function replayTree(graph: Graph, told: Told, failures: string[]): number {
  const registers = new Map<string, Register>()
  for (const [id, spec] of graph.states) if (quietStart(spec)) registers.set(id, start)
  const waiting = [...registers.keys()]
  let replayed = 0
  for (let id = waiting.shift(); id !== undefined; id = waiting.shift()) {
    const register = registers.get(id)
    if (register === undefined) continue
    for (const edge of graph.edges) {
      if (edge.from !== id || !treeActions.includes(edge.action)) continue
      const source = graph.states.get(edge.from)
      const target = graph.states.get(edge.to)
      if (!source || !target) throw new Error(`missing structure state for ${edge.action}`)
      const where = told(source, target, edge.action)
      const made = text(target, "maker") === "agent" ? "GroupAgent" : "GroupPerson"
      const next = treeStep(register, edge.action === "GroupBy" ? made : edge.action)
      const refused = text(target, "groupKind") === "refused"
      if (next === null || (next === "refused") !== refused) {
        failures.push(`structure ${where} ${next === null ? "was refused" : "did not match the refusal"}`)
        continue
      }
      const after = next === "refused" ? register : next
      const expected = {
        formed: text(target, "grouped") === "formed",
        grouped: text(target, "grouped") === "formed",
        x: step + step * shownOf(target),
      }
      if (!same(picture(after), expected)) {
        failures.push(
          `structure ${where}\n  actual ${JSON.stringify(picture(after))}\n  expected ${JSON.stringify(expected)}`,
        )
        continue
      }
      replayed += 1
      if (!registers.has(edge.to)) {
        registers.set(edge.to, after)
        waiting.push(edge.to)
      }
    }
  }
  return replayed
}

export function replayStructure(graph: Graph, told: Told, failures: string[]) {
  return { replayed: replayNodes(graph, told, failures), grouped: replayTree(graph, told, failures), stuttered: 0 }
}
