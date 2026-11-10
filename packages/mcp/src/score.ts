import { catalog, projectTools } from "@airdesign/catalog"
import type { Tab } from "@airdesign/device"
import { elementId, type NodeRegister } from "@airdesign/document"
import type { Deck } from "@airdesign/engine"
import { emptyLog } from "./admit.js"
import { callTool, type AgentCaller, type ToolResult } from "./call-tool.js"

export type ScoreStep = {
  readonly name: string
  readonly raw: unknown
  readonly tab?: Tab
}

export type ScoreTask = {
  readonly landed: readonly string[]
  readonly steps: readonly ScoreStep[]
}

export type ScoreResult = {
  readonly pass: boolean
  readonly deck: Deck
}

const projected = projectTools(catalog)
const captureName = projected.find((tool) => tool.op === "capture_slide")?.name

function toolName(op: string): string {
  const name = projected.find((tool) => tool.op === op)?.name
  if (name === undefined) throw new Error(op)
  return name
}

function pairedBody(register: Deck["register"]): NodeRegister | null {
  const stored = register.elements[elementId("b")]
  if (stored !== undefined) return stored
  if (!Object.hasOwn(register, "b")) return null
  const body = (register as { readonly b?: NodeRegister | null }).b
  if (body === undefined || body === null) return null
  return body
}

function landedValues(deck: Deck): readonly string[] {
  const values = deck.register.landed.map((row) => row.value)
  const opened = elementId("a")
  const paired = elementId("b")
  const extra: string[] = []
  for (const id of deck.register.nodes) {
    if (id === opened || id === paired) continue
    const body = deck.register.elements[id]
    if (body === undefined) continue
    for (const row of body.landed) extra.push(row.value)
  }
  const side = pairedBody(deck.register)
  if (side === null) return [...values, ...extra]
  return [...values, ...extra, ...side.landed.map((row) => row.value)]
}

function reportsCapturedFile(result: ToolResult): boolean {
  return result.content.some((block) => /captured file|file was captured|image\/png|\.png\b|\.pptx\b/i.test(block.text))
}

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function score(task: ScoreTask, deck: Deck, caller: AgentCaller): ScoreResult {
  let current = deck
  for (const step of task.steps) {
    const before = current
    const log = emptyLog()
    const now = 0
    const session =
      step.tab === undefined ? { caller, deck: current, log, now } : { caller, deck: current, tab: step.tab, log, now }
    const result = callTool(step.name, step.raw, session)
    if (captureName !== undefined && step.name === captureName) {
      if (result.deck !== before || reportsCapturedFile(result)) return { pass: false, deck: result.deck }
      continue
    }
    if (result.ok) current = result.deck
  }
  const values = landedValues(current)
  return { pass: sameOrder(values, task.landed), deck: current }
}

const deckId = "deck"

export const landSourceTask: ScoreTask = {
  landed: ["21"],
  steps: [
    {
      name: toolName("edit_deck"),
      raw: { deck: deckId, base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] },
    },
  ],
}

export const staleEditTask: ScoreTask = {
  landed: [],
  steps: [
    {
      name: toolName("edit_deck"),
      raw: { deck: deckId, base: 1, changes: [{ value: "21", node: "258.7", readAt: 0 }] },
    },
  ],
}

export const captureAbsentTask: ScoreTask = {
  landed: [],
  steps: [
    {
      name: toolName("capture_slide"),
      raw: { deck: deckId },
      tab: { presence: "absent" },
    },
  ],
}
