import { describe, expect, it } from "vitest"

import type { ModelCall } from "./aira.js"
import { Replay } from "./aira-replay.js"

const call = {} as ModelCall

async function eventsOf(replay: Replay): Promise<unknown[]> {
  const opened = await replay.transport(call, "key", new AbortController().signal)
  if (!opened.ok) return [opened.status]
  const seen: unknown[] = []
  for await (const event of opened.events) seen.push(event)
  return seen
}

function toolInput(events: readonly unknown[]): unknown {
  const pieces = events.flatMap((event) => {
    const delta = (event as { delta?: { type?: string; partial_json?: string } }).delta
    return delta?.type === "input_json_delta" ? [delta.partial_json ?? ""] : []
  })
  return JSON.parse(pieces.join(""))
}

describe("Replay", () => {
  it("plays its scripts one call each and repeats the last", async () => {
    const replay = new Replay()
    replay.play({ name: "tool.sse" }, { name: "rate-limit.json" }, { name: "turn.sse" })
    const played = [await eventsOf(replay), await eventsOf(replay), await eventsOf(replay), await eventsOf(replay)]
    expect(played.map((events) => (events[0] as { message?: { id?: string } }).message?.id ?? events[0])).toEqual([
      "msg_fixture_tool",
      429,
      "msg_fixture_turn",
      "msg_fixture_turn",
    ])
  })

  it("writes each filled value where the fixture names it", async () => {
    const replay = new Replay()
    replay.play({ name: "edit.sse", fill: { deck: "deckone", base: "7", node: "256.2" } })
    expect(toolInput(await eventsOf(replay))).toEqual({
      deck: "deckone",
      base: 7,
      changes: [{ node: "256.2", readAt: 0, value: '[{"from":0,"runs":[{"from":0,"text":"Hello from Aira"}]}]' }],
    })
  })
})
