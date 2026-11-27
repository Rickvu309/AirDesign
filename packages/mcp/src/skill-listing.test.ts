import { bytesOf } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { memoryDecks } from "@airdesign/agent/testing/evals"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"

import { createServer } from "./index.js"

function started(): doom.Doom {
  return doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ name: "Title", children: [] }] }).doom
}

async function listedTools() {
  let minted = 0
  const server = createServer({ agent: "aira", mint: () => `minted${String((minted += 1))}` }, memoryDecks(started))
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    return (await client.listTools()).tools
  } finally {
    await client.close()
    await server.close()
  }
}

it("lists both tools as read-only and adds under 400 tokens to the advertised listing", async () => {
  const tools = await listedTools()
  const names = tools.map((tool) => tool.name)
  expect(names).toContain("airdesign_read_skill")
  expect(names).toContain("airdesign_get_style")

  const advertised = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
  }))
  const added = advertised.filter((tool) => tool.name === "airdesign_read_skill" || tool.name === "airdesign_get_style")
  const rest = advertised.filter((tool) => tool.name !== "airdesign_read_skill" && tool.name !== "airdesign_get_style")
  const beforeTokens = Math.ceil(bytesOf(JSON.stringify(rest)) / 4)
  const afterTokens = Math.ceil(bytesOf(JSON.stringify(advertised)) / 4)
  expect(afterTokens - beforeTokens).toBeLessThan(400)

  for (const tool of added) {
    expect(tool.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    })
  }
  expect(tools.every((tool) => !Object.hasOwn(tool, "outputSchema"))).toBe(true)
})
