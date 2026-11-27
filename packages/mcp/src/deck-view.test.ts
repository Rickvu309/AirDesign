import * as doom from "@airdesign/doom"
import { testTheme } from "@airdesign/doom/testing"
import { viewTools } from "@airdesign/catalog"
import { memoryDecks } from "@airdesign/agent/testing/evals"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"

import { createServer, type ViewHost } from "./index.js"

const origin = "https://studio.example"
const uri = "ui://airdesign/deck.html"

type Seen = { readonly tool: string; readonly body: unknown; readonly held?: boolean }

function viewHost(seen: Seen[]): ViewHost {
  return {
    origin,
    open: async (body) => {
      seen.push({ tool: "open", body })
      return { ok: true, deck: "d1", rev: 4, fold: { rev: 4 } }
    },
    since: async (body, signal) => {
      seen.push({ tool: "since", body, held: !signal.aborted })
      return { ok: true, deck: "d1", rev: 4, edits: [], screenshots: true }
    },
    screenshots: async (body) => {
      seen.push({ tool: "screenshots", body })
      return { ok: true, deck: "d1", missing: [] }
    },
  }
}

async function withClient(view: ViewHost | undefined, use: (client: Client) => Promise<void>): Promise<void> {
  let minted = 0
  const server = createServer(
    { agent: "aira", mint: () => `minted${String((minted += 1))}` },
    memoryDecks(() => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom),
    view,
  )
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    await use(client)
  } finally {
    await client.close()
    await server.close()
  }
}

type UiMeta = { readonly resourceUri?: string; readonly visibility?: readonly string[] }
const uiOf = (tool: { readonly _meta?: Record<string, unknown> | undefined }) => tool._meta?.ui as UiMeta | undefined

describe("the deck view as an MCP App", () => {
  it("serves a shell that loads the deck view from the web origin, allowed by its CSP", async () => {
    await withClient(viewHost([]), async (client) => {
      const { contents } = await client.readResource({ uri })
      expect(contents).toHaveLength(1)
      const [shell] = contents
      expect(shell).toMatchObject({ uri, mimeType: "text/html;profile=mcp-app" })
      const html = (shell as { text: string }).text
      expect(html).toMatch(/^<!doctype html>/)
      expect(html).toContain(`<base href="${origin}/">`)
      expect(html).toContain("data-mcp-app")
      expect(html).toContain('fetch("deck-view")')
      expect(shell?._meta).toEqual({
        ui: {
          csp: { connectDomains: [origin], resourceDomains: [origin], baseUriDomains: [origin] },
          prefersBorder: true,
        },
      })
    })
  })

  it("shows the view for execute and get_app_state and lists the view's tools for the app only", async () => {
    await withClient(viewHost([]), async (client) => {
      const { tools } = await client.listTools()
      const shown = tools.filter((tool) => uiOf(tool)?.resourceUri === uri && uiOf(tool)?.visibility === undefined)
      expect(shown.map((tool) => tool.name)).toEqual(["airdesign_execute", "airdesign_get_app_state"])
      for (const tool of shown) expect(tool._meta?.["ui/resourceUri"]).toBe(uri)
      const appOnly = tools.filter((tool) => uiOf(tool)?.visibility !== undefined)
      expect(appOnly.map((tool) => tool.name).sort()).toEqual(Object.values(viewTools).sort())
      for (const tool of appOnly) expect(uiOf(tool)).toEqual({ resourceUri: uri, visibility: ["app"] })
    })
  })

  it("answers each view tool with the deck's wire answer, holding since on a live signal", async () => {
    const seen: Seen[] = []
    await withClient(viewHost(seen), async (client) => {
      const opened = await client.callTool({ name: viewTools.open, arguments: { deck: "d1" } })
      expect(opened.structuredContent).toEqual({ ok: true, deck: "d1", rev: 4, fold: { rev: 4 } })
      expect(opened.isError).not.toBe(true)
      const caught = await client.callTool({ name: viewTools.since, arguments: { deck: "d1", rev: 4, wait: true } })
      expect(caught.structuredContent).toEqual({ ok: true, deck: "d1", rev: 4, edits: [], screenshots: true })
      const shots = { keys: [], images: [] }
      const kept = await client.callTool({
        name: viewTools.screenshots,
        arguments: { deck: "d1", rev: 4, screenshots: shots },
      })
      expect(kept.structuredContent).toEqual({ ok: true, deck: "d1", missing: [] })
    })
    expect(seen).toEqual([
      { tool: "open", body: { deck: "d1" } },
      { tool: "since", body: { deck: "d1", rev: 4, wait: true }, held: true },
      { tool: "screenshots", body: { deck: "d1", rev: 4, screenshots: { keys: [], images: [] } } },
    ])
  })

  it("serves no view, no view tools and no view links without a view host", async () => {
    await withClient(undefined, async (client) => {
      const { tools } = await client.listTools()
      expect(tools.map((tool) => tool.name)).not.toContain(viewTools.open)
      for (const tool of tools) expect(tool._meta?.ui).toBeUndefined()
      await expect(client.readResource({ uri })).rejects.toThrow()
    })
  })
})
