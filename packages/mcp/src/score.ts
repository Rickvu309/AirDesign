import { catalog, projectTools } from "@airdesign/catalog"
import type { Tab } from "@airdesign/device"
import type { Deck } from "@airdesign/engine"
import { callTool, type AgentCaller, type ToolResult } from "./call-tool.js"

export type ScoreStep = {
  readonly name: string
  readonly raw: unknown
  readonly tab?: Tab
}

export type ScoreTask = {
  readonly source: readonly string[]
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

function landedValues(deck: Deck): readonly string[] {
  const values = deck.register.landed.map((row) => row.value)
  const side = deck.register.b
  if (side === null) return values
  return [...values, ...side.landed.map((row) => row.value)]
}

function reportsCapturedFile(result: ToolResult): boolean {
  return result.content.some((block) => /captured file|file was captured|image\/png|\.png\b|\.pptx\b/i.test(block.text))
}

export function score(task: ScoreTask, deck: Deck, caller: AgentCaller): ScoreResult {
  let current = deck
  for (const step of task.steps) {
    const before = current
    const session = step.tab === undefined ? { caller, deck: current } : { caller, deck: current, tab: step.tab }
    const result = callTool(step.name, step.raw, session)
    if (captureName !== undefined && step.name === captureName) {
      if (result.deck !== before || reportsCapturedFile(result)) return { pass: false, deck: result.deck }
      continue
    }
    if (result.ok) current = result.deck
  }
  const values = landedValues(current)
  return { pass: values.every((value) => task.source.includes(value)), deck: current }
}

const deckId = "deck"

export const landSourceTask: ScoreTask = {
  source: ["21"],
  steps: [
    {
      name: toolName("edit_deck"),
      raw: { deck: deckId, base: 0, changes: [{ value: "21" }] },
    },
  ],
}

export const staleEditTask: ScoreTask = {
  source: ["21"],
  steps: [
    {
      name: toolName("edit_deck"),
      raw: { deck: deckId, base: 1, changes: [{ value: "22" }] },
    },
  ],
}

export const captureAbsentTask: ScoreTask = {
  source: ["21"],
  steps: [
    {
      name: toolName("capture_slide"),
      raw: { deck: deckId },
      tab: { presence: "absent" },
    },
  ],
}
