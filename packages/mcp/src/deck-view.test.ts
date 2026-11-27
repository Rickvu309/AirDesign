import * as doom from "@airdesign/doom"
import { testTheme } from "@airdesign/doom/testing"
import { viewTools } from "@airdesign/catalog"
import { memoryDecks } from "@airdesign/agent/testing/evals"
import { Client, InMemoryTransport, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"

import { createServer, createServerHandler, type ViewHost } from "./index.js"

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

async function withHttpClient(mimeTypes: string[] | undefined, use: (client: Client) => Promise<void>): Promise<void> {
  const host = memoryDecks(
    () => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom,
  )
  const view = viewHost([])
  const client = new Client(
    { name: "airdesign-test", version: "0.0.0" },
    {
      versionNegotiation: { mode: { pin: "2026-07-28" } },
      capabilities: mimeTypes === undefined ? {} : { extensions: { "io.modelcontextprotocol/ui": { mimeTypes } } },
    },
  )
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL("https://studio.example/mcp"), {
        fetch: async (input, init) => {
          const request = new Request(input, init)
          const body = new Uint8Array(await request.clone().arrayBuffer())
          const handler = createServerHandler({ agent: "aira", mint: () => "minted" }, host, body, {}, view)
          try {
            return await handler.fetch(request)
          } finally {
            await handler.close()
          }
        },
      }),
    )
    await use(client)
  } finally {
    await client.close()
  }
}

describe("the deck view as an MCP App", () => {
  it.each([{ mimeTypes: undefined }, { mimeTypes: ["text/plain"] }])(
    "serves only core tools over HTTP without Apps HTML support (%j)",
    async ({ mimeTypes }) => {
      await withHttpClient(mimeTypes, async (client) => {
        const { tools } = await client.listTools()
        expect(tools).toHaveLength(6)
        for (const tool of tools) {
          expect(tool._meta?.ui).toBeUndefined()
          expect(tool._meta?.["ui/resourceUri"]).toBeUndefined()
        }
        expect((await client.listResources()).resources.map((resource) => resource.uri)).not.toContain(uri)
        await expect(client.readResource({ uri })).rejects.toThrow()
        await expect(client.callTool({ name: viewTools.open, arguments: { deck: "d1" } })).rejects.toThrow()
      })
    },
  )

  it("serves the deck view over HTTP to clients that advertise Apps HTML support", async () => {
    await withHttpClient(["text/html;profile=mcp-app"], async (client) => {
      expect(client.getServerCapabilities()?.extensions?.["io.modelcontextprotocol/ui"]).toEqual({
        mimeTypes: ["text/html;profile=mcp-app"],
      })
      const { tools } = await client.listTools()
      expect(tools).toHaveLength(9)
      expect(
        tools
          .filter((tool) => uiOf(tool)?.visibility?.includes("app"))
          .map((tool) => tool.name)
          .sort(),
      ).toEqual(Object.values(viewTools).sort())
      expect(uiOf(tools.find((tool) => tool.name === "airdesign_execute") ?? {})).toEqual({ resourceUri: uri })
      expect((await client.listResources()).resources.map((resource) => resource.uri)).toContain(uri)
      expect((await client.readResource({ uri })).contents[0]).toMatchObject({ uri })
      const opened = await client.callTool({ name: viewTools.open, arguments: { deck: "d1" } })
      expect(opened.structuredContent).toMatchObject({ ok: true, deck: "d1" })
    })
  })

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
