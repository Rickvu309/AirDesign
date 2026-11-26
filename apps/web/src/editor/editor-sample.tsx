import { catalog, projectTools, type AgentOp } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { memoryDoomRemote, memoryStorage } from "@airdesign/live"
import { useState } from "react"
import type { AiraChat, AiraExchange, AiraStep } from "@/aira/aira-loop"
import type { AiraStart } from "@/aira/aira-panel"
import { sampleDeck } from "@/samples/sample-slides"
import { Editor, type EditorStart } from "./editor"
import type { Saving } from "./use-save-shown"

const deck = "sample-deck"
const asked = "Make a strategy review for the board from my notes. Lead with the numbers, then the three levers."
const resets = "2026-11-30T08:00:00.000Z"
const usage = { used: 38, allowed: 100, resets }
const spent = { used: 100, allowed: 100, resets }
const usageReader =
  (week: typeof usage): NonNullable<AiraStart["usage"]> =>
  () =>
    Promise.resolve({ kind: "usage", email: "sample@airdesign.app", usage: week, available: true })
const loadUsage = usageReader(usage)

const toolOf = (op: AgentOp) => projectTools(catalog).find((tool) => tool.op === op)?.name ?? op

const step = (op: AgentOp, at: number, state: "working" | "done"): AiraStep => ({
  kind: "tool",
  id: `sample-${String(at)}`,
  name: toolOf(op),
  state,
})

const said: AiraStep = { kind: "text", text: "Seven slides from your notes, numbers first, then the three levers." }

function chatOf(exchange: Omit<AiraExchange, "asked">, week = usage): AiraChat {
  return { deck, history: [], answers: [], usage: week, exchanges: [{ asked, ...exchange }] }
}

const done = chatOf({
  steps: [
    said,
    step("execute", 2, "done"),
    { kind: "text", text: "Your deck is ready. Every number comes from your notes." },
  ],
  end: "done",
  runs: ["sample-run"],
})

export const airaSamples = {
  working: {
    chat: chatOf({ steps: [said, step("execute", 2, "working")], end: "working", runs: ["sample-run"] }),
  },
  done: { chat: done },
  failed: { chat: chatOf({ steps: [said, step("execute", 2, "done")], end: "failed", runs: ["sample-run"] }) },
  limit: {
    chat: chatOf({ steps: [said], end: "out-of-usage", runs: [] }, spent),
    usage: usageReader(spent),
  },
  long: {
    chat: done,
    draft:
      "Make the revenue chart tell the story faster. Lead with the 2025 number, then show the trend across all five years. Keep our colors and label each bar with its value. Add one takeaway line under the title, and cut the source note down to a single line so the slide breathes.",
  },
} satisfies Record<string, AiraStart>

export const sampleText = sampleDeck.ids["subtitle"]

export const saveSamples = {
  offline: { status: { kind: "offline" }, online: false },
  unreached: { status: { kind: "offline" }, online: true },
  setAside: { status: { kind: "set-aside", edits: 2, tooLarge: false }, online: true },
  setAsideTooLarge: { status: { kind: "set-aside", edits: 1, tooLarge: true }, online: true },
} satisfies Record<string, Saving>

const groupSizes = [1, 3, 3]

function grouped(): doom.Edit {
  const first = sampleDeck.slides[0]
  const row = first === undefined ? undefined : doom.parentOf(sampleDeck.doom.nodes.get(first))
  const deckId = sampleDeck.ids["deck"]
  if (row == null || deckId === undefined) return sampleDeck.edit
  let rowAt = row.at
  let start = 0
  const writes = groupSizes.slice(1).flatMap((size, group): doom.Write[] => {
    start += groupSizes[group] ?? 0
    rowAt = doom.orderKeyBetween(rowAt, null)
    const id = doom.nodeId(`group:${String(group + 1)}`)
    let at: doom.OrderKey | null = null
    return [
      { node: id, prop: "type", value: "slideRow" },
      { node: id, prop: "parent", value: { id: deckId, at: rowAt } },
      ...sampleDeck.slides.slice(start, start + size).map((slide): doom.Write => {
        at = doom.orderKeyBetween(at, null)
        return { node: slide, prop: "parent", value: { id, at } }
      }),
    ]
  })
  return { ...sampleDeck.edit, writes: [...sampleDeck.edit.writes, ...writes] }
}

export const groupedSample = { groups: groupSizes, size: doom.deckOf(sampleDeck.doom).size }

function opened(edit: doom.Edit) {
  const remote = memoryDoomRemote(edit)
  void remote.create({ deck })
  return { remote, storage: memoryStorage() }
}

export function EditorSample({ start }: { readonly start: EditorStart }) {
  const [open] = useState(() => opened(start.grid === undefined ? sampleDeck.edit : grouped()))
  return (
    <div className="relative">
      <Editor id={deck} open={open} start={{ ...start, aira: { usage: loadUsage, ...start.aira } }} />
    </div>
  )
}
