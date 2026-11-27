import type { ReplyBlock } from "@airdesign/catalog"
import type { AiraStep } from "@/aira/aira-loop"

type ToolStep = Extract<AiraStep, { kind: "tool" }>

const summaryLength = 80

export function stepSummary(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const summary = raw.trim()
  return summary === "" || summary.length > summaryLength ? undefined : summary
}

export function calledSteps(steps: readonly AiraStep[], content: readonly ReplyBlock[]): readonly AiraStep[] {
  const calls = content.filter((block) => block.type === "tool_use")
  const summaries = new Map(calls.map((block) => [block.id, stepSummary(block.input.summary)]))
  const labelled = (step: ToolStep): ToolStep => {
    const summary = summaries.get(step.id)
    return summary === undefined ? step : { ...step, summary }
  }
  const shown = new Set(steps.flatMap((step) => (step.kind === "tool" ? [step.id] : [])))
  const missing = calls
    .filter((block) => !shown.has(block.id))
    .map((block) => labelled({ kind: "tool", id: block.id, name: block.name, state: "working" }))
  return [...steps.map((step) => (step.kind === "tool" ? labelled(step) : step)), ...missing]
}
