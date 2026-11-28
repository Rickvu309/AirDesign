import * as doom from "@airdesign/doom"
import { testTheme } from "@airdesign/doom/testing"
import { viewTools } from "@airdesign/catalog"
import { memoryDecks } from "@airdesign/agent/testing/evals"
import { Client, InMemoryTransport, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"

import { deckViewShell, shellFailed } from "./deck-view.js"
import { createServer, createServerHandler, type ViewHost } from "./index.js"

const origin = "https://studio.example"
const origins = { app: origin, site: "https://site.example" }
const uri = "ui://airdesign/deck-v2.html"
const appsHtml = "text/html;profile=mcp-app"
const image = "a".repeat(64)

type Seen = { readonly tool: string; readonly body: unknown; readonly held?: boolean }

function viewHost(seen: Seen[]): ViewHost {
  return {
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
    media: async (body) => {
      seen.push({ tool: "media", body })
      return { ok: true, deck: "d1", sha256: image, data: "cGljdHVyZQ==" }
    },
  }
}

async function withClient(view: ViewHost | undefined, use: (client: Client) => Promise<void>): Promise<void> {
  let minted = 0
  const server = createServer(
    { agent: "aira", mint: () => `minted${String((minted += 1))}` },
    memoryDecks(() => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom),
    origins,
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

async function withHttpClient(
  version: "2025-11-25" | "2026-07-28",
  mimeTypes: string[] | undefined,
  use: (client: Client) => Promise<void>,
): Promise<void> {
  const host = memoryDecks(
    () => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom,
  )
  const view = viewHost([])
  const client = new Client(
    { name: "airdesign-test", version: "0.0.0" },
    {
      versionNegotiation: { mode: version === "2025-11-25" ? "legacy" : { pin: version } },
      capabilities: mimeTypes === undefined ? {} : { extensions: { "io.modelcontextprotocol/ui": { mimeTypes } } },
    },
  )
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL("https://studio.example/mcp"), {
        fetch: async (input, init) => {
          const request = new Request(input, init)
          const body = new Uint8Array(await request.clone().arrayBuffer())
          const handler = createServerHandler({ agent: "aira", mint: () => "minted" }, host, body, {}, origins, view)
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

type Tag = {
  readonly localName: string
  getAttribute(name: string): string | null
  hasAttribute(name: string): boolean
}
type ShellDocument = {
  readonly head: { querySelectorAll(selector: string): Iterable<Tag> & { readonly length: number } }
  getElementById(id: string): { readonly textContent: string | null } | null
}
type Shelled = { readonly document: ShellDocument; readonly fetched: readonly string[] }

async function runShell(answer: (url: string) => Promise<Response>): Promise<Shelled> {
  const module = "jsdom"
  const { JSDOM } = (await import(module)) as {
    JSDOM: new (html: string, options: { url: string }) => { window: { document: ShellDocument; DOMParser: unknown } }
  }
  const html = deckViewShell(origin)
  const { window } = new JSDOM(html, { url: "https://sandbox.example/view" })
  const script = /<script type="module">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ""
  const fetched: string[] = []
  const AsyncFunction = (async () => undefined).constructor as new (
    ...names: string[]
  ) => (...values: unknown[]) => Promise<void>
  await new AsyncFunction("document", "fetch", "DOMParser", script)(
    window.document,
    async (url: URL | string) => {
      fetched.push(String(url))
      return answer(String(url))
    },
    window.DOMParser,
  )
  return { document: window.document, fetched }
}

describe("the deck view as an MCP App", () => {
  it.each([{ mimeTypes: undefined }, { mimeTypes: ["text/plain"] }])(
    "serves only core tools over HTTP without Apps HTML support (%j)",
    async ({ mimeTypes }) => {
      await withHttpClient("2026-07-28", mimeTypes, async (client) => {
        expect(client.getServerCapabilities()?.extensions?.["io.modelcontextprotocol/ui"]).toBeUndefined()
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

  it.each(["2025-11-25", "2026-07-28"] as const)(
    "names AirDesign and titles every tool for a %s client over HTTP",
    async (version) => {
      await withHttpClient(version, [appsHtml], async (client) => {
        expect(client.getServerVersion()).toMatchObject({
          name: "app.airdesign/studio",
          title: "AirDesign",
          websiteUrl: "https://site.example",
          icons: [{ src: `${origin}/favicon-art.svg` }, { src: `${origin}/apple-touch-icon.png` }],
        })
        const { tools } = await client.listTools()
        expect(tools).toHaveLength(10)
        for (const tool of tools) expect(tool.title, tool.name).toMatch(/^[A-Z][a-z]+(?: [a-z]+)+$/)
      })
    },
  )

  it("serves the deck view over HTTP to clients that advertise Apps HTML support", async () => {
    await withHttpClient("2026-07-28", [appsHtml], async (client) => {
      expect(client.getServerCapabilities()?.extensions?.["io.modelcontextprotocol/ui"]).toEqual({
        mimeTypes: ["text/html;profile=mcp-app"],
      })
      const { tools } = await client.listTools()
      expect(tools).toHaveLength(10)
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

  it.each([{ mimeTypes: undefined }, { mimeTypes: [appsHtml] }])(
    "serves the deck view and its capability to every 2025-11-25 client over HTTP (%j)",
    async ({ mimeTypes }) => {
      await withHttpClient("2025-11-25", mimeTypes, async (client) => {
        expect(client.getNegotiatedProtocolVersion()).toBe("2025-11-25")
        expect(client.getServerCapabilities()?.extensions?.["io.modelcontextprotocol/ui"]).toEqual({
          mimeTypes: [appsHtml],
        })
        const { tools } = await client.listTools()
        expect(tools).toHaveLength(10)
        expect(uiOf(tools.find((tool) => tool.name === "airdesign_execute") ?? {})).toEqual({ resourceUri: uri })
        expect((await client.readResource({ uri })).contents[0]).toMatchObject({ uri })
      })
    },
  )

  it.each(["", "{", "[1,"])(
    "answers a body that is not JSON with a parse error, not a server fault (%j)",
    async (text) => {
      const handler = createServerHandler(
        { agent: "aira", mint: () => "minted" },
        memoryDecks(() => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom),
        new TextEncoder().encode(text),
        {},
        origins,
        viewHost([]),
      )
      try {
        const answer = await handler.fetch(
          new Request("https://studio.example/mcp", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json, text/event-stream",
              "mcp-protocol-version": "2026-07-28",
            },
            body: text,
          }),
        )
        expect(answer.status).toBe(400)
        expect(await answer.json()).toMatchObject({ error: { code: -32700 } })
      } finally {
        await handler.close()
      }
    },
  )

  it("serves a shell that names the web origin without a base URL, allowed by its CSP", async () => {
    await withClient(viewHost([]), async (client) => {
      const { contents } = await client.readResource({ uri })
      expect(contents).toHaveLength(1)
      const [shell] = contents
      expect(shell).toMatchObject({ uri, mimeType: appsHtml })
      const html = (shell as { text: string }).text
      expect(html).toMatch(/^<!doctype html>/)
      expect(html).not.toContain("<base")
      expect(html).toContain(`<html lang="en" data-mcp-app data-origin="${origin}">`)
      expect(shell?._meta).toEqual({
        ui: { csp: { connectDomains: [origin], resourceDomains: [origin] }, prefersBorder: true },
        "openai/widgetDomain": origin,
      })
    })
  })

  it("serves the corrected loader to clients that still use the previous URI", async () => {
    const previousUri = "ui://airdesign/deck.html"
    await withClient(viewHost([]), async (client) => {
      const current = await client.readResource({ uri })
      const previous = await client.readResource({ uri: previousUri })
      expect(previous.contents).toEqual(current.contents.map((content) => ({ ...content, uri: previousUri })))
    })
  })

  it("names the web origin as ChatGPT's widget domain and leaves Claude's hashed sandbox domain to Claude", async () => {
    await withClient(viewHost([]), async (client) => {
      const [shell] = (await client.readResource({ uri })).contents
      expect(shell?._meta?.["openai/widgetDomain"]).toBe(origin)
      expect(shell?._meta?.ui).not.toHaveProperty("domain")
    })
  })

  it("loads the deck view's tags from the web origin by absolute URLs, under a document from another origin", async () => {
    const built = `<!doctype html><html><head>
      <link rel="icon" href="/favicon-32.png" />
      <script type="module" crossorigin src="/assets/deck-view.js"></script>
      <link rel="modulepreload" crossorigin href="/assets/dist.js">
      <link rel="stylesheet" crossorigin href="/assets/dist.css">
      </head><body><div id="root"></div></body></html>`
    const { document, fetched } = await runShell(async () => new Response(built))
    expect(fetched).toEqual([`${origin}/deck-view`])
    expect(
      [...document.head.querySelectorAll("script[src], link")].map((tag) => [
        tag.localName,
        tag.getAttribute("src") ?? tag.getAttribute("href"),
        tag.hasAttribute("crossorigin"),
      ]),
    ).toEqual([
      ["script", `${origin}/assets/deck-view.js`, true],
      ["link", `${origin}/assets/dist.js`, true],
      ["link", `${origin}/assets/dist.css`, true],
    ])
    expect(document.getElementById("root")?.textContent).toBe("")
  })

  it.each([
    { failure: "a refused fetch", answer: async () => Promise.reject(new TypeError("Failed to fetch")) },
    { failure: "a server error", answer: async () => new Response("down", { status: 502 }) },
  ])("says the deck could not load after $failure instead of a blank box", async ({ answer }) => {
    const { document } = await runShell(answer)
    expect(document.getElementById("root")?.textContent).toBe(shellFailed)
    expect(document.head.querySelectorAll("script[src], link")).toHaveLength(0)
  })

  it("shows the view for execute and get_app_state and lists the view's tools for the app only", async () => {
    await withClient(viewHost([]), async (client) => {
      expect(client.getServerCapabilities()?.extensions?.["io.modelcontextprotocol/ui"]).toEqual({
        mimeTypes: [appsHtml],
      })
      const { tools } = await client.listTools()
      const shown = tools.filter((tool) => uiOf(tool)?.resourceUri === uri && uiOf(tool)?.visibility === undefined)
      expect(shown.map((tool) => tool.name)).toEqual(["airdesign_execute", "airdesign_get_app_state"])
      for (const tool of shown) expect(tool._meta?.["ui/resourceUri"]).toBe(uri)
      const appOnly = tools.filter((tool) => uiOf(tool)?.visibility !== undefined)
      expect(appOnly.map((tool) => tool.name).sort()).toEqual(Object.values(viewTools).sort())
      for (const tool of appOnly) expect(uiOf(tool)).toEqual({ resourceUri: uri, visibility: ["app"] })
    })
  })

  it("titles the view's tools and marks all but delivering screenshots as reads of AirDesign alone", async () => {
    await withClient(viewHost([]), async (client) => {
      const { tools } = await client.listTools()
      const reads = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      expect(
        Object.fromEntries(
          tools
            .filter((tool) => uiOf(tool)?.visibility !== undefined)
            .map((tool) => [tool.name, { title: tool.title, annotations: tool.annotations }]),
        ),
      ).toEqual({
        [viewTools.open]: { title: "Read deck", annotations: reads },
        [viewTools.since]: { title: "Wait for edits", annotations: reads },
        [viewTools.screenshots]: {
          title: "Send screenshots",
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        [viewTools.media]: { title: "Read image", annotations: reads },
      })
    })
  })

  it("flags a view tool's refusal as an error and still hands the view the refusal", async () => {
    const refused = async () => ({ ok: false, refusal: "owner" })
    const view = { open: refused, since: refused, screenshots: refused, media: refused }
    await withClient(view, async (client) => {
      for (const name of Object.values(viewTools)) {
        const answer = await client.callTool({ name, arguments: { deck: "d1" } })
        expect(answer, name).toEqual({ content: [], structuredContent: { ok: false, refusal: "owner" }, isError: true })
      }
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
      const read = await client.callTool({ name: viewTools.media, arguments: { deck: "d1", sha256: image } })
      expect(read.structuredContent).toEqual({ ok: true, deck: "d1", sha256: image, data: "cGljdHVyZQ==" })
    })
    expect(seen).toEqual([
      { tool: "open", body: { deck: "d1" } },
      { tool: "since", body: { deck: "d1", rev: 4, wait: true }, held: true },
      { tool: "screenshots", body: { deck: "d1", rev: 4, screenshots: { keys: [], images: [] } } },
      { tool: "media", body: { deck: "d1", sha256: image } },
    ])
  })

  it("serves no view, no view tools and no view links without a view host", async () => {
    await withClient(undefined, async (client) => {
      expect(client.getServerCapabilities()?.extensions?.["io.modelcontextprotocol/ui"]).toBeUndefined()
      const { tools } = await client.listTools()
      expect(tools.map((tool) => tool.name)).not.toContain(viewTools.open)
      for (const tool of tools) expect(tool._meta?.ui).toBeUndefined()
      await expect(client.readResource({ uri })).rejects.toThrow()
    })
  })
})
