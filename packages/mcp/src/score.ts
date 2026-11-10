import { catalog, projectTools } from "@airdesign/catalog"
import type { Tab } from "@airdesign/device"
import { history, type NodeRegister, type Register } from "@airdesign/document"
import type { Deck } from "@airdesign/engine"
import { emptyLog } from "./admit.js"
import { callTool, type ToolResult } from "./call-tool.js"

export const elements = {
  opened: "a",
  title: "258.7",
  body: "258.8",
  note: "259.1",
  footer: "259.2",
} as const

export type ElementName = keyof typeof elements

export type EditableName = Exclude<ElementName, "opened">

export type Tool = "edit_deck" | "capture_slide"

export type AttemptCall = {
  readonly name: string
  readonly raw: unknown
  readonly tab?: Tab
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
    readonly tool: Tool | null
    readonly elements: Readonly<Partial<Record<EditableName, readonly string[]>>>
  }
}

export type ScoreResult = {
  readonly pass: boolean
  readonly reason: string
  readonly deck: Deck
  readonly start: Deck
}

const projected = projectTools(catalog)

function toolName(op: Tool): string {
  const name = projected.find((tool) => tool.op === op)?.name
  if (name === undefined) throw new Error(op)
  return name
}

const toolNames = { edit_deck: toolName("edit_deck"), capture_slide: toolName("capture_slide") } as const

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

export function capture(deck: string, tab: Tab): AttemptCall {
  return { name: toolNames.capture_slide, raw: { deck }, tab }
}

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function reportsCapturedFile(result: ToolResult): boolean {
  return result.content.some((block) => /captured file|file was captured|image\/png|\.png\b|\.pptx\b/i.test(block.text))
}

function bodyOf(register: Register, id: string): NodeRegister | null {
  if (id === elements.opened) return register
  return register.elements[id] ?? null
}

function picture(register: Register, id: string): string {
  const body = bodyOf(register, id)
  if (body === null) return "missing"
  return JSON.stringify({
    floor: body.floor,
    phase: body.phase,
    runId: body.runId,
    guarded: body.guarded,
    slides: body.slides,
    bytes: id === elements.opened ? null : body.bytes,
    landed: body.landed.map((row) => [row.actor, row.value, row.visible]),
  })
}

function touched(start: Deck, end: Deck, named: Task["want"]["elements"]): boolean {
  const unnamed = new Set<string>([...start.register.nodes, ...end.register.nodes])
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

export function score(task: Task, attempt: Attempt): ScoreResult {
  const start = task.deck()
  const failed = (reason: string, deck: Deck): ScoreResult => ({ pass: false, reason, deck, start })
  if (attempt.length > task.want.calls) return failed("calls", start)
  if (task.want.tool !== null && !attempt.some((step) => step.name === toolNames[task.want.tool ?? "edit_deck"])) {
    return failed("tool", start)
  }
  let current = start
  const caller = { actor: "agent" as const, runId: "run" }
  for (const step of attempt) {
    const before = current
    const log = emptyLog()
    const now = 0
    const session =
      step.tab === undefined ? { caller, deck: current, log, now } : { caller, deck: current, tab: step.tab, log, now }
    const result = callTool(step.name, step.raw, session)
    if (step.name === toolNames.capture_slide) {
      if (result.deck !== before || reportsCapturedFile(result)) return failed("captured", result.deck)
      continue
    }
    if (result.ok) current = result.deck
  }
  if (touched(start, current, task.want.elements)) return failed("touched", current)
  if (!landedMatches(current, task.want.elements)) return failed("landed", current)
  return { pass: true, reason: "ok", deck: current, start }
}
