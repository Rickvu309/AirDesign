import type { ModelMessage } from "@airdesign/catalog"
import { describe, expect, it } from "vitest"
import { airaChat, type AiraChat, type AiraExchange } from "@/aira/aira-loop"
import {
  chatBytes,
  chatTitle,
  chatsKept,
  droppedChats,
  leftOut,
  newestOfEach,
  readSavedChat,
  restoredChat,
  saveStep,
  savedChat,
  type SavedChat,
} from "@/aira/aira-history"

const deck = "historydeck"
const edit = "airdesign_edit_deck"
const asked = "Make the title shorter"

function sizeOf(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

function doneChat(): AiraChat {
  const exchange: AiraExchange = {
    asked,
    steps: [
      { kind: "tool", id: "t1", name: edit, state: "done" },
      { kind: "text", text: "The title is shorter." },
    ],
    end: "done",
    runs: ["run1"],
  }
  const history: ModelMessage[] = [
    { role: "user", content: asked },
    { role: "assistant", content: [{ type: "tool_use", id: "t1", name: edit, input: { deck } }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "Edited." }] },
    { role: "assistant", content: [{ type: "text", text: "The title is shorter." }] },
  ]
  return { ...airaChat(deck), history, exchanges: [exchange] }
}

function saved(chat: AiraChat, id = "c1", updated = 2_000): SavedChat {
  return savedChat(chat, { id, started: 1_000, updated })
}

describe("a chat's title", () => {
  it.each([
    ["Fix the typos on every slide", "Fix the typos on every slide"],
    [
      "Make an 8-slide investor update from my notes. Calm, data first.",
      "Make an 8-slide investor update from my notes",
    ],
    [
      "Make the Q3 investor update lead with the number. Keep it calm.",
      "Make the Q3 investor update lead with the number",
    ],
    ["Q3 investor update, please!", "Q3 investor update, please"],
    ["What's 3.5 times 2? Then put it on slide one.", "What's 3.5 times 2"],
    ["  Line one  \nline two", "Line one"],
    ["Shorten   every\ttitle.", "Shorten every title"],
    ["a".repeat(300), "a".repeat(120)],
    [`${"word ".repeat(40)}end`, "word ".repeat(24).trim()],
    ["...", "..."],
  ])("of %j is %j", (ask, title) => {
    expect(chatTitle(ask)).toBe(title)
  })
})

describe("a saved chat", () => {
  it("keeps the first ask whole, the title from it, the steps, the runs, and no usage", () => {
    const kept = saved({ ...doneChat(), usage: { used: 1, allowed: 2, resets: "2026-11-16T00:00:00.000Z" } })
    expect(kept).toMatchObject({ id: "c1", deck, title: asked, asked, started: 1_000, updated: 2_000 })
    expect(kept.exchanges[0]?.runs).toEqual(["run1"])
    expect(kept).not.toHaveProperty("usage")
    expect(readSavedChat(JSON.parse(JSON.stringify(kept)), deck)).toEqual(kept)
  })

  it("keeps a failed Undo and its remaining runs when the saved chat is restored", () => {
    const chat = doneChat()
    const exchange: AiraExchange = { ...chat.exchanges[0]!, undoFailed: true, runs: ["remaining"] }
    const kept = saved({ ...chat, exchanges: [exchange] })
    const read = readSavedChat(JSON.parse(JSON.stringify(kept)), deck)
    expect(read?.exchanges).toEqual([exchange])
    expect(read && restoredChat(read).exchanges).toEqual([exchange])
  })

  it("keeps the layers an Undo left in place when the saved chat is restored", () => {
    const chat = doneChat()
    const exchange: AiraExchange = {
      ...chat.exchanges[0]!,
      end: "undone",
      kept: ["“Revenue”", "a group"],
      left: ["“Card”"],
      skipped: ["“Tile”"],
    }
    const read = readSavedChat(JSON.parse(JSON.stringify(saved({ ...chat, exchanges: [exchange] }))), deck)
    expect(read?.exchanges).toEqual([exchange])
  })

  it("keeps why a step was refused and where the request was tried again", () => {
    const chat = doneChat()
    const exchange: AiraExchange = {
      asked,
      steps: [
        { kind: "tool", id: "t1", name: edit, state: "refused", refusal: "stale" },
        { kind: "retry" },
        { kind: "tool", id: "t2", name: edit, state: "done" },
      ],
      end: "done",
      runs: ["run1"],
    }
    const kept = saved({ ...chat, exchanges: [exchange] })
    expect(readSavedChat(JSON.parse(JSON.stringify(kept)), deck)?.exchanges).toEqual([exchange])
  })

  it("reads the whole first sentence as the title of a chat saved with a shorter one", () => {
    const kept = saved(doneChat())
    const older = {
      ...JSON.parse(JSON.stringify(kept)),
      title: "Make the",
      asked: "Make the title shorter. Keep it calm.",
    }
    expect(readSavedChat(older, deck)?.title).toBe("Make the title shorter")
  })

  it("leaves out the oldest tool results first when the chat is over its bytes, and stays continuable", () => {
    const big = "x".repeat(chatBytes)
    const chat = doneChat()
    const history = chat.history.map((message, index): ModelMessage =>
      index === 2 ? { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: big }] } : message,
    )
    const kept = saved({ ...chat, history })
    expect(sizeOf(kept)).toBeLessThanOrEqual(chatBytes)
    expect(kept.history[2]?.content).toEqual([{ type: "tool_result", tool_use_id: "t1", content: leftOut }])
    expect(kept.exchanges).toEqual(chat.exchanges)
  })

  it("keeps the record without the model's messages when its words alone are over the bytes", () => {
    const words = "y".repeat(7_000)
    const exchanges = Array.from({ length: 40 }, (_, index) => ({
      asked: `${String(index)} ${words}`,
      steps: [{ kind: "text" as const, text: words }],
      end: "done" as const,
      runs: [],
    }))
    const history = exchanges.flatMap((exchange): ModelMessage[] => [
      { role: "user", content: exchange.asked },
      { role: "assistant", content: [{ type: "text", text: words }] },
    ])
    const kept = saved({ ...airaChat(deck), history, exchanges })
    expect(sizeOf(kept)).toBeLessThanOrEqual(chatBytes)
    expect(kept.history).toEqual([])
    expect(kept.exchanges.at(-1)).toEqual(exchanges.at(-1))
    expect(kept.exchanges.length).toBeLessThan(exchanges.length)
    expect(kept.asked).toBe(exchanges[0]?.asked)
  })

  it("reads nothing from a value that is not a saved chat of this deck, and drops model messages that do not read", () => {
    const kept = saved(doneChat())
    for (const bad of [
      null,
      "chat",
      { ...kept, deck: "otherdeck" },
      { ...kept, id: 4 },
      { ...kept, exchanges: [{}] },
    ]) {
      expect(readSavedChat(bad, deck)).toBeUndefined()
    }
    expect(readSavedChat({ ...kept, history: [{ role: "assistant", content: "x" }] }, deck)).toEqual({
      ...kept,
      history: [],
      answers: [],
    })
  })
})

describe("a restored chat", () => {
  it("shows a finished chat as it was, with its runs, and runs nothing", () => {
    const chat = doneChat()
    expect(restoredChat(saved(chat))).toEqual({ ...chat, usage: null })
  })

  it("ends a reply the tab closed in as stopped, and answers its open tool calls so the chat can go on", () => {
    const working: AiraChat = {
      ...airaChat(deck),
      history: [
        { role: "user", content: asked },
        {
          role: "assistant",
          content: [
            { type: "tool_use", id: "t1", name: edit, input: { deck } },
            { type: "tool_use", id: "t2", name: edit, input: { deck } },
          ],
        },
      ],
      answers: [{ type: "tool_result", tool_use_id: "t1", content: "Edited." }],
      exchanges: [
        {
          asked,
          steps: [
            { kind: "tool", id: "t1", name: edit, state: "done" },
            { kind: "tool", id: "t2", name: edit, state: "working" },
          ],
          end: "working",
          runs: ["run1"],
        },
      ],
    }
    const restored = restoredChat(saved(working))
    expect(restored.exchanges[0]?.end).toBe("stopped")
    expect(restored.exchanges[0]?.steps[1]).toMatchObject({ id: "t2", state: "stopped" })
    expect(restored.answers.map((answer) => answer.tool_use_id)).toEqual(["t1", "t2"])
    expect(restored.answers[1]).toMatchObject({ is_error: true })
  })
})

describe("the chats this device keeps for a deck", () => {
  it(`drops the oldest beyond ${String(chatsKept)}, never the open one`, () => {
    const list = Array.from({ length: chatsKept + 2 }, (_, index) => saved(doneChat(), `c${String(index)}`, index))
    expect(droppedChats(list, "c5")).toEqual(["c1", "c0"])
    expect(droppedChats(list, "c0")).toEqual(["c2", "c1"])
    expect(droppedChats(list.slice(0, chatsKept), "c0")).toEqual([])
  })

  it("keeps the newest copy of each chat when the page's shelf and the device store both hold it", () => {
    const stored = saved(doneChat(), "c1", 1)
    const shelved = saved(doneChat(), "c1", 2)
    const other = saved(doneChat(), "c2", 3)
    const older = saved(doneChat(), "c2", 0)
    expect(newestOfEach([stored, other, shelved, older])).toEqual([shelved, other])
  })
})

describe("saving a chat as it changes", () => {
  it("writes one at a time and then only the newest change of each chat, so a closed tab loses at most the write in flight", () => {
    const one = saved(doneChat(), "c1", 1)
    const two = saved(doneChat(), "c1", 2)
    const other = saved(doneChat(), "c2", 3)
    const three = saved(doneChat(), "c1", 4)
    let step = saveStep({ writing: false, next: [] }, { type: "changed", chat: one })
    expect(step.write).toBe(one)
    step = saveStep(step.queue, { type: "changed", chat: two })
    expect(step.write).toBeNull()
    step = saveStep(step.queue, { type: "changed", chat: other })
    step = saveStep(step.queue, { type: "changed", chat: three })
    expect(step.queue).toEqual({ writing: true, next: [other, three] })
    step = saveStep(step.queue, { type: "written" })
    expect(step.write).toBe(other)
    step = saveStep(step.queue, { type: "written" })
    expect(step.write).toBe(three)
    step = saveStep(step.queue, { type: "written" })
    expect(step).toEqual({ queue: { writing: false, next: [] }, write: null })
  })
})
