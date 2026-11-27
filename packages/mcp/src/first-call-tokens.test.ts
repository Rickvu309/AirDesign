import { bytesOf } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { memoryDecks } from "@airdesign/agent/testing/evals"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"

import { createServer, type ViewHost } from "./index.js"
import { testTheme } from "@airdesign/doom/testing"

type Listing = Awaited<ReturnType<Client["listTools"]>>
type Tool = Listing["tools"][number]

const firstCallLimit = 1_000

const tokensOf = (text: string) => Math.ceil(bytesOf(text) / 4)

function modelSees(tool: Tool): boolean {
  const visibility = (tool._meta?.ui as { visibility?: string[] } | undefined)?.visibility
  return visibility === undefined || visibility.includes("model")
}

function modelReads(tool: Tool): Omit<Tool, "_meta"> {
  const { _meta: _hostReads, ...read } = tool
  return read
}

function firstCallTokens(listing: Listing, instructions: string): number {
  return (
    tokensOf(JSON.stringify({ ...listing, tools: listing.tools.filter(modelSees).map(modelReads) })) +
    tokensOf(instructions)
  )
}

function firstCallFault(listing: Listing, instructions: string): string | undefined {
  const tokens = firstCallTokens(listing, instructions)
  if (tokens <= firstCallLimit) return undefined
  return `A host reads ${String(tokens)} tokens of tool listing and instructions before its first call, over the limit of ${String(firstCallLimit)}.`
}

const unanswered = async () => ({ ok: false, refusal: "deck" })
const deckView: ViewHost = {
  origin: "https://studio.example",
  open: unanswered,
  since: unanswered,
  screenshots: unanswered,
}

async function firstCall(view: ViewHost | null = deckView): Promise<{ listing: Listing; instructions: string }> {
  let minted = 0
  const server = createServer(
    { agent: "aira", mint: () => `minted${String((minted += 1))}` },
    memoryDecks(() => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom),
    view ?? undefined,
  )
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    return { listing: await client.listTools(), instructions: client.getInstructions() ?? "" }
  } finally {
    await client.close()
    await server.close()
  }
}

const appOnly: Tool = {
  name: "airdesign_view_select",
  description: "Tells the agent which layers the person selected in the deck view.",
  inputSchema: { type: "object", properties: { layers: { type: "array", items: { type: "string" } } } },
  _meta: { ui: { visibility: ["app"] } },
}

it("costs a host at most 1,000 tokens for the listing and the instructions together", async () => {
  const { listing, instructions } = await firstCall()
  expect(instructions).not.toBe("")
  expect(firstCallFault(listing, instructions)).toBeUndefined()
})

it("counts a tool only the app can call as nothing", async () => {
  const { listing, instructions } = await firstCall()
  const withApp = { ...listing, tools: [...listing.tools, appOnly] }
  expect(firstCallTokens(withApp, instructions)).toBe(firstCallTokens(listing, instructions))
  const forModel = {
    ...listing,
    tools: [...listing.tools, { ...appOnly, _meta: { ui: { visibility: ["model", "app"] } } }],
  }
  expect(firstCallTokens(forModel, instructions)).toBeGreaterThan(firstCallTokens(listing, instructions))
})

it("adds no token the model reads when the deck view is served", async () => {
  const served = await firstCall()
  const plain = await firstCall(null)
  expect(served.listing.tools.length).toBeGreaterThan(plain.listing.tools.length)
  const tokens = firstCallTokens(served.listing, served.instructions)
  console.log(`first call: ${String(tokens)} tokens the model reads, with and without the deck view`)
  expect(tokens).toBe(firstCallTokens(plain.listing, plain.instructions))
})

it("fails at 1,001 tokens and passes at 1,000", async () => {
  const { listing, instructions } = await firstCall()
  const room = (firstCallLimit - firstCallTokens(listing, instructions)) * 4
  expect(firstCallFault(listing, `${instructions}${"x".repeat(room)}`)).toBeUndefined()
  expect(firstCallFault(listing, `${instructions}${"x".repeat(room + 4)}`)).toBe(
    `A host reads 1001 tokens of tool listing and instructions before its first call, over the limit of 1000.`,
  )
})
