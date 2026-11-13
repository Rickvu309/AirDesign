import { catalog, projectTools, type ElementOp, type SlideOp, type WireRefusal } from "@airdesign/catalog"
import {
  elementGone,
  elementId,
  history,
  presentSlides,
  rootElement,
  type ElementId,
  type NodeRegister,
  type Register,
} from "@airdesign/document"
import { liveRuns, type Deck } from "@airdesign/engine"
import { emptyLog } from "./admit.js"
import { callTool, type ToolResult } from "./call-tool.js"
import { memoryTurns } from "./turn.js"

export type ElementName = "opened" | "title" | "body" | "note" | "footer"

export const elements: Readonly<Record<ElementName, ElementId>> = {
  opened: rootElement,
  title: elementId("258.7"),
  body: elementId("258.8"),
  note: elementId("259.1"),
  footer: elementId("259.2"),
}

export const fixtureRun = "run"

export type EditableName = Exclude<ElementName, "opened">

export type Tool = "edit_deck" | "read_deck" | SlideOp | ElementOp

export type AttemptCall = {
  readonly name: string
  readonly raw: unknown
}

export type Outcome = "ok" | WireRefusal | "thrown"

export type Reason = "ok" | "calls" | "tool" | "touched" | "landed"

export type Step = {
  readonly name: Tool
  readonly outcome: Outcome
}

export type Attempt = readonly AttemptCall[]

export type Write = {
  readonly element: ElementName
  readonly value: string
  readonly readAt: number
  readonly floor?: string
}

export type Task = {
  readonly id: string
  readonly prompt: string
  readonly deck: () => Deck
  readonly want: {
    readonly calls: number
    readonly steps: readonly Step[]
    readonly slides?: readonly string[]
    readonly added?: readonly string[]
    readonly removed?: readonly string[]
    readonly elements: Readonly<Partial<Record<EditableName, readonly string[]>>>
  }
}

export type Answer = {
  readonly name: string
  readonly outcome: string
}

export type ScoreResult = {
  readonly pass: boolean
  readonly reason: Reason
  readonly answers: readonly Answer[]
  readonly deck: Deck
  readonly start: Deck
}

const projected = projectTools(catalog)

function toolName(op: Tool): string {
  const name = projected.find((tool) => tool.op === op)?.name
  if (name === undefined) throw new Error(op)
  return name
}

const toolNames = {
  edit_deck: toolName("edit_deck"),
  read_deck: toolName("read_deck"),
  add_slide: toolName("add_slide"),
  duplicate_slide: toolName("duplicate_slide"),
  delete_slide: toolName("delete_slide"),
  move_slide: toolName("move_slide"),
  add_text_box: toolName("add_text_box"),
  delete_element: toolName("delete_element"),
} as const

export function edit(deck: string, writes: readonly Write[], base = 0): AttemptCall {
  return {
    name: toolNames.edit_deck,
    raw: {
      deck,
      base,
      changes: writes.map((write) => ({
        value: write.value,
        node: elements[write.element],
        readAt: write.readAt,
        ...(write.floor === undefined ? {} : { floor: write.floor }),
      })),
    },
  }
}

export function readDeck(deck: string): AttemptCall {
  return { name: toolNames.read_deck, raw: { deck } }
}

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function bodyOf(register: Register, id: ElementId): NodeRegister | null {
  return register.elements[id] ?? null
}

function picture(register: Register, id: ElementId): string {
  const body = bodyOf(register, id)
  if (body === null) return "missing"
  return JSON.stringify({
    floor: body.floor,
    phase: body.phase,
    runId: body.runId,
    guarded: body.guarded,
    slides: body.slides,
    bytes: body.bytes,
    landed: body.landed.map((row) => [row.actor, row.value, row.visible]),
  })
}

function touched(start: Deck, end: Deck, named: Task["want"]["elements"]): boolean {
  const unnamed = new Set<ElementId>([...start.register.nodes, ...end.register.nodes])
  for (const [name, id] of Object.entries(elements)) {
    if (Object.hasOwn(named, name)) unnamed.delete(id)
    else unnamed.add(id)
  }
  for (const id of unnamed) {
    if (picture(start.register, id) !== picture(end.register, id)) return true
  }
  return false
}

function landedMatches(deck: Deck, named: Task["want"]["elements"]): boolean {
  for (const [name, id] of Object.entries(elements)) {
    if (!Object.hasOwn(named, name)) continue
    const expected = (named as Readonly<Record<string, readonly string[]>>)[name] ?? []
    const body = bodyOf(deck.register, id)
    if (!sameOrder(body === null ? [] : history(body), expected)) return false
  }
  return true
}

function elementsLanded(register: Register, want: Task["want"]): boolean {
  const added = register.order.flatMap((row) => (row.slide === "element-add" ? [row.element.node] : []))
  const removed = register.order.flatMap((row) => (row.slide === "element-remove" ? [row.node] : []))
  if (
    want.added !== undefined &&
    !sameOrder(
      added.filter((node) => !elementGone(register, node)),
      want.added,
    )
  ) {
    return false
  }
  return (
    want.removed === undefined ||
    sameOrder(
      removed.filter((node) => elementGone(register, node)),
      want.removed,
    )
  )
}

function nameOf(step: unknown): string {
  if (typeof step !== "object" || step === null) return ""
  const name = (step as { readonly name?: unknown }).name
  return typeof name === "string" ? name : ""
}

function answeredInOrder(steps: readonly Step[], answers: readonly Answer[]): boolean {
  let next = 0
  for (const answer of answers) {
    const step = steps[next]
    if (step === undefined) break
    if (answer.name === toolNames[step.name] && answer.outcome === step.outcome) next += 1
  }
  return next === steps.length
}

export function score(task: Task, attempt: Attempt): ScoreResult {
  const start = task.deck()
  const answers: Answer[] = []
  const failed = (reason: Reason, deck: Deck): ScoreResult => ({ pass: false, reason, answers, deck, start })
  if (attempt.length > task.want.calls) return failed("calls", start)
  let current = start
  const caller = { actor: "agent" as const, runId: "session" }
  const turns = memoryTurns()
  if (liveRuns(start).includes(fixtureRun)) {
    turns.write(start.id, { runId: fixtureRun, lastCall: 0, revision: start.revision })
  }
  for (const step of attempt) {
    const log = emptyLog()
    const now = 0
    const session = { caller, deck: current, log, now, turns }
    let result: ToolResult
    try {
      result = callTool(step.name, step.raw, session)
    } catch {
      answers.push({ name: nameOf(step), outcome: "thrown" })
      continue
    }
    answers.push({ name: step.name, outcome: result.ok ? "ok" : result.refusal })
    if (result.ok) current = result.deck
  }
  if (!answeredInOrder(task.want.steps, answers)) return failed("tool", current)
  if (touched(start, current, task.want.elements)) return failed("touched", current)
  if (
    task.want.slides !== undefined &&
    !sameOrder(
      presentSlides(current.register).map((row) => row.id),
      task.want.slides,
    )
  )
    return failed("landed", current)
  if (!landedMatches(current, task.want.elements)) return failed("landed", current)
  if (!elementsLanded(current.register, task.want)) return failed("landed", current)
  return { pass: true, reason: "ok", answers, deck: current, start }
}
