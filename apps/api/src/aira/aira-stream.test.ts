import { describe, expect, it } from "vitest"

import { streamEvents } from "../testing/aira-replay.js"
import { play, type AiraEvent, type Played } from "./aira-stream.js"

async function* listed(events: readonly unknown[], breaks = false): AsyncIterable<unknown> {
  for (const event of events) yield event
  if (breaks) throw new Error("socket")
}

async function played(events: readonly unknown[], breaks = false) {
  const seen: AiraEvent[] = []
  const stream = play(listed(events, breaks))
  for (;;) {
    const next = await stream.next()
    if (next.done === true) return { seen, played: next.value satisfies Played }
    seen.push(next.value)
  }
}

const answeredText = "Lead with the claim. Then show the evidence."
const start = { type: "message_start", message: { usage: { input_tokens: 10, output_tokens: 1 } } }
const stopped = { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 9 } }

function toolBlock(index: number, name: string, json: readonly string[]): unknown[] {
  return [
    { type: "content_block_start", index, content_block: { type: "tool_use", id: `toolu_${index}`, name, input: {} } },
    ...json.map((partial_json) => ({
      type: "content_block_delta",
      index,
      delta: { type: "input_json_delta", partial_json },
    })),
    { type: "content_block_stop", index },
  ]
}

describe("play relays one model turn", () => {
  it("streams each text delta and settles the text and the usage of message_delta", async () => {
    const { seen, played: result } = await played(streamEvents("turn.sse"))
    expect(seen).toEqual([
      { type: "text", text: "Lead with the claim." },
      { type: "text", text: " Then show the evidence." },
    ])
    expect(result).toEqual({
      kind: "settled",
      stop: "end_turn",
      content: [{ type: "text", text: "Lead with the claim. Then show the evidence." }],
      counts: { input: 412, output: 57, write5m: 200, write1h: 0, read: 100 },
    })
  })

  it("streams a tool call once its input is whole and keeps it after the text in the turn's content", async () => {
    const { seen, played: result } = await played(streamEvents("tool.sse"))
    const call = { id: "toolu_fixture_read", name: "airdesign_read_deck", input: { deck: "airadeck" } }
    expect(seen).toEqual([
      { type: "text", text: "I will read the deck" },
      { type: "text", text: " first." },
      { type: "tool", ...call },
    ])
    expect(result).toMatchObject({
      kind: "settled",
      stop: "tool_use",
      content: [
        { type: "text", text: "I will read the deck first." },
        { type: "tool_use", ...call },
      ],
      counts: { input: 2950, output: 61 },
    })
  })

  it("keeps thinking with its signature and redacted thinking as the model sent them, in block order", async () => {
    const { seen, played: result } = await played(streamEvents("thinking.sse"))
    const input = { deck: "airadeck", base: 1, changes: [{ node: "258.7", value: "Q3 results", readAt: 0 }] }
    expect(seen).toEqual([{ type: "tool", id: "toolu_fixture_edit", name: "airdesign_edit_deck", input }])
    expect(result).toMatchObject({
      kind: "settled",
      content: [
        { type: "thinking", thinking: "", signature: "EqQBCgIYAhIMfixturesignature" },
        { type: "redacted_thinking", data: "EmwKAhgBEgyfixtureredacted" },
        { type: "tool_use", id: "toolu_fixture_edit", name: "airdesign_edit_deck", input },
      ],
    })
  })

  it("gives a call with no input or input that is not an object an empty input", async () => {
    const { played: result } = await played([
      start,
      ...toolBlock(0, "airdesign_list_decks", [""]),
      ...toolBlock(1, "airdesign_list_decks", ['["a"]']),
      ...toolBlock(2, "airdesign_list_decks", ['{"deck": "a']),
      stopped,
    ])
    expect(result).toMatchObject({
      content: [0, 1, 2].map((index) => ({ type: "tool_use", id: `toolu_${index}`, input: {} })),
    })
  })

  it("drops a call to a tool outside the catalog and blocks it does not know, so they are never run or sent back", async () => {
    const { seen, played: result } = await played([
      start,
      ...toolBlock(0, "bash", ['{"command": "ls"}']),
      { type: "content_block_start", index: 1, content_block: { type: "fallback" } },
      { type: "content_block_stop", index: 1 },
      { type: "content_block_start", index: 2, content_block: { type: "text", text: "" } },
      { type: "content_block_stop", index: 2 },
      { type: "future_event" },
      stopped,
    ])
    expect(seen).toEqual([])
    expect(result).toEqual({
      kind: "settled",
      stop: "tool_use",
      content: [],
      counts: { input: 10, output: 9, write5m: 0, write1h: 0, read: 0 },
    })
  })

  it("drops a turn whose stream ends or breaks before message_delta and releases one the API refused first", async () => {
    const reported = { input: 412, write5m: 200, read: 100 }
    expect((await played(streamEvents("dropped.sse"))).played).toEqual({ kind: "dropped", started: reported })
    expect((await played(streamEvents("turn.sse").slice(0, 5), true)).played).toEqual({
      kind: "dropped",
      started: reported,
    })
    expect((await played(streamEvents("overloaded.sse"))).played).toEqual({ kind: "released" })
    const late = { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }
    expect((await played([...streamEvents("tool.sse").slice(0, 4), late])).played).toEqual({
      kind: "dropped",
      started: { input: 2950, write5m: 0, read: 0 },
    })
  })

  it("drops a stream that ends before message_start with no usage reported", async () => {
    expect((await played([], true)).played).toEqual({ kind: "dropped", started: null })
    expect((await played([])).played).toEqual({ kind: "dropped", started: null })
  })

  it("settles a stream that breaks after message_delta at the usage message_delta reported", async () => {
    const events = streamEvents("turn.sse")
    const delta = events.findIndex((event) => (event as { type?: string }).type === "message_delta")
    expect((await played(events.slice(0, delta + 1), true)).played).toEqual({
      kind: "settled",
      stop: "end_turn",
      content: [{ type: "text", text: answeredText }],
      counts: { input: 412, output: 57, write5m: 200, write1h: 0, read: 100 },
    })
  })
})
