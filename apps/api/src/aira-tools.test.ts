import { randomBytes } from "node:crypto"

import { countryHeader, mcpRoutes } from "@airdesign/catalog"
import { Client as McpClient, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, expect, it } from "vitest"

import { Replay } from "./testing/aira-replay.js"
import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

const deck = "airadeck"
const mails: Mail[] = []
const replay = new Replay()
let main = ""
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "aira-tools-session")
  const deckPool = openPool(info.deck, "aira-tools-deck")
  const listen = new DeckListen(info.listen)
  const served = await serve({
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    session,
    deck: deckPool,
    listen,
    send: async (mail) => {
      mails.push(mail)
    },
    aira: {
      on: true,
      key: "test-key-not-real",
      secret: "test-user-secret-not-real-0123456789abcdef",
      transport: replay.transport,
      log: () => {},
    },
  })
  main = served.base
  close = async () => {
    await served.close()
    await listen.close()
    await session.end()
    await deckPool.end()
  }
})

afterAll(async () => {
  await close()
})

type Listed = Awaited<ReturnType<McpClient["listTools"]>>["tools"][number]

function modelSees(tool: Listed): boolean {
  const visibility = (tool._meta?.ui as { visibility?: readonly string[] } | undefined)?.visibility
  return visibility === undefined || visibility.includes("model")
}

it("gives Aira the tools a host's model sees on MCP, and the server instructions", async () => {
  const cookie = await signInByCode(main, mails, `aira${randomBytes(6).toString("hex")}@example.com`)
  const client = new McpClient({ name: "parity", version: "0" })
  await client.connect(
    new StreamableHTTPClientTransport(new URL(mcpRoutes.mcp.path, main), { requestInit: { headers: { cookie } } }),
  )
  try {
    const { tools } = await client.listTools()
    const instructions = client.getInstructions()
    expect(instructions).toContain("read the `slides` guide with airdesign_read_skill")
    replay.play({ name: "turn.sse" })
    const body = { deck, messages: [{ role: "user", content: "How should slide two open?" }] }
    expect((await ask(main, "POST", "/aira/turn", body, cookie, { [countryHeader]: "VN" })).status).toBe(200)
    const call = replay.calls.at(-1)?.call
    expect(tools.filter(modelSees).length).toBeLessThan(tools.length)
    expect(call?.tools).toEqual(
      tools
        .filter(modelSees)
        .map(({ name, description, inputSchema }) => ({ name, description, input_schema: inputSchema })),
    )
    expect(call?.system).toContain(`${deck}.\n\n${instructions}`)
    expect(call?.system).not.toContain("Read the open deck before editing.")
  } finally {
    await client.close()
  }
})
