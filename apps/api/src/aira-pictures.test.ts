import { randomBytes } from "node:crypto"

import { airaTools, countryHeader, pictureTokenCeiling } from "@airdesign/catalog"
import { bytesOf } from "@airdesign/doom"
import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"

import { limits } from "@airdesign/doom"
import { airaMaxTokens, airaSystem, airaTurnCap } from "./aira/aira.js"
import { Replay } from "./testing/aira-replay.js"
import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

const vietnam = { [countryHeader]: "VN" }
const deck = "airadeck"
const read = { type: "tool_use", id: "toolu_fixture_read", name: "airdesign_read_deck", input: { deck, picture: true } }
const data = "A".repeat(400_000)
const pictured = {
  type: "tool_result",
  tool_use_id: read.id,
  content: [
    { type: "text", text: "Slide 1 (256) at revision 4:" },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
  ],
}
const messages = [
  { role: "user", content: "Look at slide one." },
  { role: "assistant", content: [read] },
  { role: "user", content: [pictured] },
]

const mails: Mail[] = []
const replay = new Replay()
let main = ""
let session: Sql = openPool("postgres://session@127.0.0.1/api")
let admin = new Client()
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  session = openPool(info.session, "aira-pictures-session")
  const deckPool = openPool(info.deck, "aira-pictures-deck")
  const listen = new DeckListen(info.listen)
  admin = new Client({ connectionString: info.admin, application_name: "aira-pictures-admin" })
  await admin.connect()
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
    await admin.end()
    await session.end()
    await deckPool.end()
  }
})

afterAll(async () => {
  await close()
})

it("keeps a turn with pictures inside the body cap every route shares", () => {
  expect(airaTurnCap).toBeLessThanOrEqual(limits.body)
})

it("sends a read's picture to the model, holds a picture's token ceiling and not its bytes, and still caps the words", async () => {
  const email = `airapictures${randomBytes(6).toString("hex")}@example.com`
  const cookie = await signInByCode(main, mails, email)
  expect(bytesOf(JSON.stringify({ deck, messages }))).toBeGreaterThan(262_144)
  replay.play({ name: "turn.sse" })
  const turn = await ask(main, "POST", "/aira/turn", { deck, messages }, cookie, vietnam)
  expect(turn.status).toBe(200)
  expect(replay.calls.at(-1)?.call).toMatchObject({ messages })
  const words = bytesOf(JSON.stringify(messages)) - data.length + pictureTokenCeiling
  const input = bytesOf(airaSystem(deck)) + bytesOf(JSON.stringify(airaTools)) + words + 64
  const held = await admin.query<{ ceiling: string }>("select ceiling from session.aira_turn where email = $1", [email])
  expect(Number(held.rows[0]?.ceiling)).toBe(input * 2_000 + airaMaxTokens * 10_000)
  const long = [
    ...messages.slice(0, -1),
    { role: "user", content: [{ ...pictured, content: [{ type: "text", text: "x".repeat(270_000) }] }] },
  ]
  const calls = replay.calls.length
  const refused = await ask(main, "POST", "/aira/turn", { deck, messages: long }, cookie, vietnam)
  expect(refused.status).toBe(413)
  expect(refused.json).toEqual({ ok: false, refusal: "size" })
  expect(replay.calls.length).toBe(calls)
})
