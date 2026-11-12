import { catalog, projectTools, type AgentOp } from "@airdesign/catalog"
import type { AiraStep, ToolState } from "@/aira-loop"

type StepWords = { readonly doing: string; readonly done: string; readonly todo: string }

export type StepLine = { readonly id: string; readonly text: string; readonly state: ToolState }

export type ReplyPiece =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "steps"; readonly title: string; readonly state: ToolState; readonly lines: readonly StepLine[] }

const unable = "Unable to"
const stopped = "Stopped"

const toolWords: Readonly<Record<AgentOp, StepWords | null>> = {
  read_deck: { doing: "Reading the deck", done: "Read the deck", todo: "read the deck" },
  edit_deck: { doing: "Editing the deck", done: "Edited the deck", todo: "edit the deck" },
  list_decks: { doing: "Reading your decks", done: "Read your decks", todo: "read your decks" },
  capture_slide: { doing: "Reading a slide", done: "Read a slide", todo: "read a slide" },
  stop_run: null,
}

const otherWords: StepWords = { doing: "Working on the deck", done: "Worked on the deck", todo: "work on the deck" }

const opOf: ReadonlyMap<string, AgentOp> = new Map(projectTools(catalog).map((tool) => [tool.name, tool.op]))

function lower(text: string): string {
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`
}

export function stepLine(name: string, state: ToolState): string | null {
  const op = opOf.get(name)
  const words = op === undefined ? otherWords : toolWords[op]
  if (words === null) return null
  if (state === "working") return words.doing
  if (state === "refused") return `${unable} ${words.todo}`
  if (state === "stopped") return `${stopped} ${lower(words.doing)}`
  return words.done
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
    title: said.map((text, index) => (index === 0 ? text : lower(text))).join(", "),
    state,
    lines,
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
      if (text !== null) group.push({ id: step.id, text, state: step.state })
      continue
    }
    pieces.push(...rowsOf(group))
    group = []
    if (step.kind === "text") pieces.push({ kind: "text", text: step.text })
  }
  pieces.push(...rowsOf(group))
  return pieces
}
