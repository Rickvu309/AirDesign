import { once } from "node:events"
import { createServer, type IncomingHttpHeaders } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, expect, it } from "vitest"

import { airaMaxTokens, airaModel, airaSystem, type ModelCall } from "./aira.js"
import { airaTools } from "./aira-conversation.js"
import { failureOf, fixtureText, streamEvents } from "./aira-replay.js"
import { anthropicTransport } from "./anthropic-transport.js"

const fakeKey = "test-key-not-real"
const call: ModelCall = {
  model: airaModel,
  max_tokens: airaMaxTokens,
  system: airaSystem("airadeck"),
  tools: airaTools,
  messages: [
    { role: "user", content: "How should slide two open?" },
    {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "", signature: "EqQBCgIYAhIMfixturesignature" },
        { type: "redacted_thinking", data: "EmwKAhgBEgyfixtureredacted" },
        { type: "text", text: "I will read the deck first." },
        { type: "tool_use", id: "toolu_fixture_read", name: "airdesign_read_deck", input: { deck: "airadeck" } },
      ],
    },
    {
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "toolu_fixture_read", content: "stale", is_error: true },
        { type: "text", text: "Keep it short." },
      ],
    },
  ],
  metadata: { user_id: "0f".repeat(32) },
  output_config: { effort: "low" },
}

let fixture = "turn.sse"
const seen: { headers: IncomingHttpHeaders; body: unknown }[] = []
const server = createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on("data", (chunk: Buffer) => chunks.push(chunk))
  req.on("end", () => {
    seen.push({ headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown })
    if (fixture.endsWith(".json")) {
      const failure = failureOf(fixture)
      res.writeHead(failure.status, { "content-type": "application/json", "request-id": "req_fixture_sdk" })
      res.end(JSON.stringify(failure.body))
      return
    }
    res.writeHead(200, { "content-type": "text/event-stream", "request-id": "req_fixture_sdk" })
    res.end(fixtureText(fixture))
  })
})
let base = ""

beforeAll(async () => {
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
})

afterAll(async () => {
  server.close()
  await once(server, "close")
})

async function opened(name: string) {
  fixture = name
  const open = await anthropicTransport(base)(call, fakeKey)
  if (!open.ok) return { open, events: [] }
  const events: unknown[] = []
  for await (const event of open.events) events.push(event)
  return { open, events }
}

it("streams a recorded tool turn through the SDK event by event", async () => {
  const { events } = await opened("tool.sse")
  expect(events).toEqual(streamEvents("tool.sse").filter((event) => (event as { type?: string }).type !== "ping"))
})

it("streams a recorded turn through the SDK with the request id, the pinned call and the given key", async () => {
  const { open, events } = await opened("turn.sse")
  expect(open).toMatchObject({ ok: true, request: "req_fixture_sdk" })
  expect(events).toEqual(streamEvents("turn.sse").filter((event) => (event as { type?: string }).type !== "ping"))
  const last = seen.at(-1)
  expect(last?.headers.authorization).toBe(`Bearer ${fakeKey}`)
  expect(last?.body).toEqual({ ...call, stream: true })
})

it("answers 429, 529 and a usage-limit 400 as failures with their type, status and request id", async () => {
  expect((await opened("rate-limit.json")).open).toEqual({
    ok: false,
    request: "req_fixture_sdk",
    status: 429,
    type: "rate_limit_error",
    message: failureOf("rate-limit.json").body.error.message,
  })
  expect((await opened("overloaded.json")).open).toMatchObject({ ok: false, status: 529, type: "overloaded_error" })
  expect((await opened("usage-limit.json")).open).toMatchObject({
    ok: false,
    status: 400,
    type: "invalid_request_error",
  })
})

it("relays an error event in the stream as an error event", async () => {
  const { open, events } = await opened("overloaded.sse")
  expect(open.ok).toBe(true)
  expect(events).toEqual([{ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }])
})
