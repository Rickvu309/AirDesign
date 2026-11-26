import { catalog, projectTools, type AgentOp } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

import { emptyLog } from "../admit.js"
import { callTool, type Session } from "../call-tool.js"
import { scriptOf } from "./change-script.js"
import { memoryDecks } from "./memory-decks.js"

export type Tool = AgentOp

export type Reason = "ok" | "calls" | "tool" | "touched" | "landed"

export type Step = { readonly name: Tool; readonly outcome: string }

export type Call = { readonly name: string; readonly raw: unknown }

export type Attempt = readonly Call[]

export type Task = {
  readonly id: string
  readonly prompt: string
  readonly deck: () => doom.Doom
  readonly want: {
    readonly calls: number
    readonly steps: readonly Step[]
    readonly touches: readonly string[]
    readonly landed: (end: doom.Doom) => boolean
  }
}

export type Answer = { readonly name: string; readonly outcome: string }

export type ScoreResult = {
  readonly pass: boolean
  readonly reason: Reason
  readonly answers: readonly Answer[]
  readonly deck: doom.Doom
  readonly start: doom.Doom
}

export const evalDeckId = "deck"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<Tool, string>

export const toolCall = (op: Tool, raw: unknown): Call => ({ name: names[op], raw })

export const run = (script: string, runId?: string, deck: string = evalDeckId): Call =>
  toolCall("execute", { deck, script, ...(runId === undefined ? {} : { runId }) })

export const read = (deck: string = evalDeckId): Call => run("get()", undefined, deck)

export const edit = (changes: readonly unknown[], runId?: string, deck: string = evalDeckId): Call =>
  run(scriptOf(changes), runId, deck)

export const stop = (runId: string, deck: string = evalDeckId): Call => toolCall("stop_run", { deck, runId })

function answeredInOrder(steps: readonly Step[], answers: readonly Answer[]): boolean {
  let next = 0
  for (const answer of answers) {
    const step = steps[next]
    if (step === undefined) break
    if (answer.name === names[step.name] && answer.outcome === step.outcome) next += 1
  }
  return next === steps.length
}

function changed(start: doom.Doom, end: doom.Doom): readonly string[] {
  return [...start.nodes].flatMap(([id, node]) => (end.nodes.get(id) === node ? [] : [id]))
}

export async function score(task: Task, attempt: Attempt): Promise<ScoreResult> {
  const start = task.deck()
  const decks = memoryDecks(() => start, new Map([[evalDeckId, start]]))
  const answers: Answer[] = []
  const end = () => decks.decks.get(evalDeckId as never) ?? start
  const failed = (reason: Reason): ScoreResult => ({ pass: false, reason, answers, deck: end(), start })
  if (attempt.length > task.want.calls) return failed("calls")
  let calls = 0
  const session: Session = { agent: "eval", mint: () => `call${String((calls += 1))}`, log: emptyLog(), now: 0 }
  for (const step of attempt) {
    try {
      const result = await callTool(step.name, step.raw, session, decks)
      answers.push({ name: step.name, outcome: result.ok ? "ok" : String(result.answer.refusal) })
    } catch {
      answers.push({ name: step.name, outcome: "thrown" })
    }
  }
  if (!answeredInOrder(task.want.steps, answers)) return failed("tool")
  const allowed = new Set(task.want.touches)
  if (changed(start, end()).some((id) => !allowed.has(id))) return failed("touched")
  if (!task.want.landed(end())) return failed("landed")
  return { pass: true, reason: "ok", answers, deck: end(), start }
}
