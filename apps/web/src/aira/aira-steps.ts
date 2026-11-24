import { catalog, projectTools, type AgentOp } from "@airdesign/catalog"
import type { AiraStep, ToolState } from "@/aira/aira-loop"
import { airaFontIssue, airaOtherStepWords, airaRefusalWords, airaStepWords, airaStepsSummary } from "@/copy/aira-copy"

export type StepLine = {
  readonly id: string
  readonly text: string
  readonly state: ToolState
  readonly reason?: string
}

export type ReplyPiece =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "steps"
      readonly title: string
      readonly state: ToolState
      readonly lines: readonly StepLine[]
      readonly reasons: readonly string[]
    }

const opOf: ReadonlyMap<string, AgentOp> = new Map(projectTools(catalog).map((tool) => [tool.name, tool.op]))

export function stepLine(name: string, state: ToolState): string | null {
  const op = opOf.get(name)
  const words = op === undefined ? airaOtherStepWords : airaStepWords[op]
  return words === null ? null : words[state]
}

const reasonOf: Readonly<Record<string, string>> = airaRefusalWords

function reasonFor(step: Extract<AiraStep, { kind: "tool" }>): string | undefined {
  if (step.state !== "refused" || step.refusal === undefined) return undefined
  if (step.fontIssue !== undefined) return airaFontIssue(step.fontIssue)
  return Object.hasOwn(reasonOf, step.refusal) ? reasonOf[step.refusal] : undefined
}

const weight: Readonly<Record<ToolState, number>> = { done: 0, stopped: 1, refused: 2, working: 3 }

function rowOf(lines: readonly StepLine[]): ReplyPiece {
  const said = [...new Set(lines.map((line) => line.text))]
  const state = lines.reduce<ToolState>(
    (worst, line) => (weight[line.state] > weight[worst] ? line.state : worst),
    "done",
  )
  return {
    kind: "steps",
    title: airaStepsSummary(said),
    state,
    lines,
    reasons: [...new Set(lines.flatMap((line) => (line.reason === undefined ? [] : [line.reason])))],
  }
}

function rowsOf(lines: readonly StepLine[]): readonly ReplyPiece[] {
  const settled = lines.filter((line) => line.state !== "working")
  const running = lines.filter((line) => line.state === "working")
  return [...(settled.length === 0 ? [] : [rowOf(settled)]), ...running.map((line) => rowOf([line]))]
}

export function replyPieces(steps: readonly AiraStep[]): readonly ReplyPiece[] {
  const pieces: ReplyPiece[] = []
  let group: StepLine[] = []
  for (const step of steps) {
    if (step.kind === "tool") {
      const text = stepLine(step.name, step.state)
      const reason = reasonFor(step)
      if (text !== null)
        group.push({ id: step.id, text, state: step.state, ...(reason === undefined ? {} : { reason }) })
      continue
    }
    pieces.push(...rowsOf(group))
    group = []
    if (step.kind === "text") pieces.push({ kind: "text", text: step.text })
  }
  pieces.push(...rowsOf(group))
  return pieces
}
