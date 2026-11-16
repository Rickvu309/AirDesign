import { describe, expect, it } from "vitest"
import { countedTransport } from "./aira-counts.mjs"

async function* stream() {
  yield {
    type: "message_start",
    message: {
      usage: {
        input_tokens: 3100,
        cache_read_input_tokens: 41_800,
        cache_creation_input_tokens: 9500,
        output_tokens: 1,
      },
    },
  }
  yield { type: "content_block_delta", delta: { type: "text_delta", text: "Done." } }
  yield { type: "message_delta", usage: { output_tokens: 1450 } }
}

describe("countedTransport", () => {
  it("writes one line of token counts per model call once its stream ends, and passes every event on", async () => {
    const lines = []
    const transport = countedTransport(
      async () => ({ ok: true, request: "req_1", events: stream() }),
      (line) => lines.push(line),
    )
    const opened = await transport({}, "key", new AbortController().signal)
    const events = []
    for await (const event of opened.events) events.push(event.type)
    expect(events).toEqual(["message_start", "content_block_delta", "message_delta"])
    expect(lines).toEqual([{ input: 3100, read: 41_800, write: 9500, output: 1450 }])
  })

  it("writes nothing for a call the API refused", async () => {
    const lines = []
    const refused = { ok: false, request: null, status: 429, type: "rate_limit_error", message: "slow down" }
    const transport = countedTransport(
      async () => refused,
      (line) => lines.push(line),
    )
    expect(await transport({}, "key", new AbortController().signal)).toBe(refused)
    expect(lines).toEqual([])
  })
})
