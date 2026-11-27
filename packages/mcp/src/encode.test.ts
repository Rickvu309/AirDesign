import * as doom from "@airdesign/doom"
import { type DeckHost } from "@airdesign/agent"
import { memoryDecks, scriptOf } from "@airdesign/agent/testing/evals"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"

import { createServer } from "./index.js"
import { testTheme } from "@airdesign/doom/testing"

const shot = "/9j/AAAA"

function started(): doom.Doom {
  return doom.doomFromTree({
    theme: testTheme,
    slides: [
      {
        name: "Title",
        children: [
          { type: "shape", name: "Title", props: { role: "title", text: doom.textFromMarkdown("Untitled", "title") } },
        ],
      },
    ],
  }).doom
}

async function replies(): Promise<Record<string, string>> {
  let minted = 0
  const session = { agent: "aira", mint: () => `minted${String((minted += 1))}` }
  const host: DeckHost = {
    ...memoryDecks(started),
    screenshots: async (_deck, _fold, slides) => new Map(slides.map((slide) => [slide, shot])),
  }
  const server = createServer(session, host)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const sent: string[] = []
  const send = serverTransport.send.bind(serverTransport)
  serverTransport.send = async (message, options) => {
    sent.push(JSON.stringify(message))
    return send(message, options)
  }
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  const reply = async (args: Record<string, unknown>) => {
    const result = await client.callTool({ name: "airdesign_execute", arguments: args })
    return { result: result.structuredContent as Record<string, any>, bytes: sent.at(-1)! }
  }
  try {
    const made = await reply({ script: 'createDeck({ name: "Board" })' })
    const deck = made.result.deck as string
    const slide = (made.result.slides as string[])[0]!
    const read = await reply({ deck, script: "get().layers" })
    const pictured = await reply({
      deck,
      script: `${scriptOf([{ op: "insert", kind: "text", parent: slide, text: "Plan" }])}; screenshot({ target: "${slide}" })`,
    })
    const refusal = await reply({ deck, script: 'update({ target: "z:9", fill: 3 })' })
    return { read: read.bytes, pictured: pictured.bytes, refusal: refusal.bytes }
  } finally {
    await client.close()
    await server.close()
  }
}

const reply = (id: number, result: Readonly<Record<string, unknown>>) => JSON.stringify({ result, jsonrpc: "2.0", id })
const text = (fields: Readonly<Record<string, unknown>>) => ({ type: "text", text: JSON.stringify(fields) })

const read = {
  ok: true,
  deck: "d1eni1dus4ud",
  rev: 2,
  problems: [],
  result: 'slide n:3 "Title" group=n:2\n  n:4 text:title name="Title" style=title resize=height text="Untitled"',
  note: "Nothing changed: the script only read the deck.",
}

const pictured = {
  ok: true,
  deck: "d1eni1dus4ud",
  rev: 3,
  runId: "r0dofbxn90nh",
  problems: [],
  screenshots: ["n:3"],
  note: "Landed as one undo step. Send runId with your next call, and to airdesign_stop_run when you are done.",
}

const refusal = {
  ok: false,
  refusal: "field",
  refused: "shape",
  field: "fill",
  fault: "form",
  form: "A colour, none, {image} or {gradient}.",
  op: 1,
  verb: "update",
  note: "Nothing landed. Operation 1 (update) at line 1: field fill. The wrong form. Accepted form: A colour, none, {image} or {gradient}.",
  line: 1,
}

it("answers a read, an edit with a screenshot and a refusal in the bytes it answered before one encoder", async () => {
  expect(await replies()).toEqual({
    read: reply(2, { content: [text(read)], structuredContent: read }),
    pictured: reply(3, {
      content: [{ type: "image", data: shot, mimeType: "image/jpeg" }, text(pictured)],
      structuredContent: pictured,
    }),
    refusal: reply(4, { content: [text(refusal)], structuredContent: refusal, isError: true }),
  })
})
