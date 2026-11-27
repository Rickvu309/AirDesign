import { scriptOf } from "@airdesign/agent/testing/evals"
import { randomBytes } from "node:crypto"

import { mcpRoutes, readDeckId } from "@airdesign/catalog"
import { nodeId, readFold } from "@airdesign/doom"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"

import { openDoom } from "./doom/doom-deck.js"
import { startIds } from "./doom/doom-start.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { postgresInfo, serve, signInByCode } from "./testing/harness.js"

it("restores a connector's original free point when undoing one agent run", async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "mcp-undo-session")
  const deck = openPool(info.deck, "mcp-undo-deck")
  const listen = new DeckListen(info.listen)
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  const mails: Mail[] = []
  const email = `undo${randomBytes(4).toString("hex")}@example.com`
  const server = await serve({
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    session,
    deck,
    listen,
    send: async (mail) => {
      mails.push(mail)
    },
  })
  try {
    const cookie = await signInByCode(server.base, mails, email)
    await client.connect(
      new StreamableHTTPClientTransport(new URL(mcpRoutes.mcp.path, server.base), {
        requestInit: { headers: { cookie } },
      }),
    )
    const call = async (name: string, args: Record<string, unknown>) => {
      const { content, structuredContent: answer } = await client.callTool({
        name: `airdesign_${name}`,
        arguments: args,
      })
      if (typeof answer !== "object" || answer === null || !("ok" in answer) || answer.ok !== true)
        throw new Error(JSON.stringify(content))
      const fields: Record<string, unknown> = { ...answer }
      return fields
    }
    const created = await call("execute", { script: 'createDeck({ name: "Board" })' })
    const parsed = readDeckId(created.deck)
    if (!parsed.ok) throw new Error("no deck in tool answer")
    const id = parsed.deck
    const fold = async () => {
      const stored = await openDoom(deck, { deck: id }, email)
      const read = stored.ok ? readFold(stored.fold) : undefined
      if (read === undefined) throw new Error("could not open stored fold")
      return read
    }
    const slide = startIds.slide
    const original = { x: 230, y: 145 }
    const end = { x: 100, y: 350 }
    const madeLine = await call("execute", {
      deck: id,
      script: scriptOf([{ op: "add", kind: "line", slide, from: original, to: end, route: "straight" }]),
    })
    const line = addedId(madeLine.made)
    const madeFrame = await call("execute", {
      deck: id,
      script: scriptOf([{ op: "add", kind: "frame", slide, box: { x: 400, y: 200, w: 200, h: 100 } }]),
    })
    const target = addedId(madeFrame.made)
    const runId = madeFrame.runId
    if (typeof runId !== "string") throw new Error("no run in tool answer")
    await call("execute", {
      deck: id,
      runId,
      script: scriptOf([{ op: "set", target: line, from: { layer: target, side: "right" } }]),
    })
    expect((await fold()).nodes.get(line)).toMatchObject({ geometry: { start: { node: target, site: "r" }, end } })
    await call("undo_run", { deck: id, runId })
    const after = await fold()
    expect(after.nodes.get(target)).toMatchObject({ parent: null })
    expect(after.nodes.get(line)).toMatchObject({ geometry: { start: original, end } })
  } finally {
    await client.close()
    await server.close()
    await Promise.all([session.end(), deck.end(), listen.close()])
  }
})

function addedId(made: unknown) {
  const first: unknown = Array.isArray(made) ? made[0] : undefined
  const id =
    typeof first === "object" && first !== null && "ids" in first && Array.isArray(first.ids) ? first.ids[0] : undefined
  if (typeof id !== "string") throw new Error("no added layer in tool answer")
  return nodeId(id)
}
