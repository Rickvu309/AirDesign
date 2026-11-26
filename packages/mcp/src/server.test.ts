import { catalog, onceMeta, projectTools } from "@airdesign/catalog"
import { bytesOf } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"

import { createServer, emptyLog, type Host, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"

function started(): doom.Doom {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
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

function sessionFor(): Session {
  return { agent: "aira", mint: () => "minted", log: emptyLog(), now: 0 }
}

async function withClient(session: Session, host: Host, use: (client: Client) => Promise<void>): Promise<void> {
  const server = createServer(session, host)
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

describe("createServer", () => {
  it("returns a new server on every call", () => {
    const session = sessionFor()
    expect(createServer(session, memoryDecks(started))).not.toBe(createServer(session, memoryDecks(started)))
  })

  it("lists the eight tools within 8,000 tokens, each as described", async () => {
    const projected = projectTools(catalog)
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      expect(client.getServerVersion()?.name).toBe("airdesign")
      const { tools } = await client.listTools()
      const advertised = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      }))
      const advertisedTokens = Math.ceil(bytesOf(JSON.stringify(advertised)) / 4)
      const listedTokens = Math.ceil(bytesOf(JSON.stringify(await client.listTools())) / 4)
      expect(tools.map((tool) => tool.name)).toEqual([
        "airdesign_create_deck",
        "airdesign_edit_deck",
        "airdesign_get_style",
        "airdesign_list_decks",
        "airdesign_read_deck",
        "airdesign_read_skill",
        "airdesign_stop_run",
        "airdesign_undo_run",
      ])
      for (const expected of projected) {
        const tool = tools.find((listed) => listed.name === expected.name)!
        expect(tool.description).toBe(expected.description)
        expect(tool.annotations).toEqual({
          readOnlyHint: expected.readOnlyHint,
          destructiveHint: expected.destructiveHint,
          idempotentHint: expected.idempotentHint,
          openWorldHint: expected.openWorldHint,
        })
      }
      const edit = tools.find((tool) => tool.name === "airdesign_edit_deck")!
      const schema = edit.inputSchema as {
        required?: string[]
        $defs?: { change?: { properties?: { op?: { enum?: string[] } } } }
      }
      expect(schema.required).toEqual(["deck", "base", "changes"])
      expect(schema.$defs?.change?.properties?.op?.enum).toEqual([
        "add",
        "set",
        "move",
        "wrap",
        "unwrap",
        "delete",
        "slide",
        "duplicate",
        "deck",
        "detach",
        "component",
      ])
      expect(advertisedTokens).toBeLessThanOrEqual(8000)
      expect(listedTokens).toBeLessThanOrEqual(8000)
      expect(tools.every((tool) => !Object.hasOwn(tool, "outputSchema"))).toBe(true)
    })
  })

  it("replaces every slide in either order over the protocol, and refuses leaving none", async () => {
    const decks = memoryDecks(started)
    await withClient(sessionFor(), decks, async (client) => {
      const call = async (name: string, args: unknown) => {
        const result = await client.callTool({ name: `airdesign_${name}`, arguments: args as Record<string, unknown> })
        return result.structuredContent as Record<string, any>
      }
      const made = await call("create_deck", { name: "Replace" })
      const deck = made.deck as string
      const [first] = made.slides as string[]
      const add = { op: "slide", add: {} }
      const gone = { op: "slide", delete: first }
      const none = await call("edit_deck", { deck, base: made.rev, changes: [gone] })
      expect(none).toMatchObject({ ok: false, refusal: "last-slide", change: "slide delete", at: 0 })
      const deleteFirst = await call("edit_deck", { deck, base: made.rev, changes: [gone, add] })
      expect(deleteFirst).toMatchObject({ ok: true })
      const read = await call("read_deck", { deck })
      expect(read.slides).toHaveLength(1)
      const [second] = read.slides as string[]
      const addFirst = await call("edit_deck", {
        deck,
        base: read.rev,
        changes: [add, { op: "slide", delete: second }],
      })
      expect(addFirst).toMatchObject({ ok: true })
      expect((await call("read_deck", { deck })).slides).toHaveLength(1)
    })
  })

  it("builds the board deck brief in six calls over the protocol", async () => {
    const decks = memoryDecks(started)
    await withClient(sessionFor(), decks, async (client) => {
      const call = async (name: string, args: unknown) => {
        const result = await client.callTool({ name: `airdesign_${name}`, arguments: args as Record<string, unknown> })
        expect(result.isError, JSON.stringify(result.content)).not.toBe(true)
        return result.structuredContent as Record<string, any>
      }
      const made = await call("create_deck", { name: "Board" })
      const deck = made.deck as string
      const first = made.slides[0] as string
      const slides = await call("edit_deck", {
        deck,
        base: made.rev,
        changes: Array.from({ length: 4 }, () => ({ op: "slide", add: {} })),
      })
      const read = await call("read_deck", { deck })
      const [, two, three, four, five] = read.slides as string[]
      const filled = await call("edit_deck", {
        deck,
        base: slides.rev,
        runId: slides.runId,
        changes: [
          { op: "add", kind: "text", slide: first, text: "Q3 board update", textStyle: "title" },
          { op: "add", kind: "kpi", slide: two, items: [{ title: "Revenue", value: "$4.2M" }] },
          {
            op: "add",
            kind: "component",
            slide: three,
            component: "column",
          },
          {
            op: "add",
            kind: "cards",
            slide: four,
            items: [{ title: "Grow", icon: "trending-up", points: ["Enter two markets"] }],
          },
          {
            op: "add",
            kind: "frame",
            slide: five,
            rows: [
              ["", "Q1"],
              ["Product", "Beta"],
            ],
          },
        ],
      })
      await call("stop_run", { deck, runId: filled.runId })
      await call("read_deck", { deck })
    })
  })

  it("takes the once an agent names in the call's meta, and refuses one in the wrong form", async () => {
    const decks = memoryDecks(started)
    await withClient(sessionFor(), decks, async (client) => {
      const once = (value: unknown) => ({ _meta: { [onceMeta]: value } })
      const first = await client.callTool({ name: "airdesign_create_deck", arguments: {}, ...once("make-1") })
      const again = await client.callTool({ name: "airdesign_create_deck", arguments: {}, ...once("make-1") })
      expect(again.structuredContent).toEqual(first.structuredContent)
      expect(decks.decks.size).toBe(1)
      const bad = await client.callTool({ name: "airdesign_create_deck", arguments: {}, ...once("not allowed!") })
      expect(bad.isError).toBe(true)
      expect(bad.structuredContent).toMatchObject({ ok: false, refusal: "field" })
    })
  })

  it("answers a refusal as an error with the answer as its structured content", async () => {
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const refused = await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "nothere" } })
      expect(refused.isError).toBe(true)
      expect(refused.structuredContent).toMatchObject({ ok: false, refusal: "deck" })
      expect(refused.content).toEqual([{ type: "text", text: JSON.stringify(refused.structuredContent) }])
    })
  })
})

describe("a gradient angle past a full turn", () => {
  it("wraps over the protocol as the panel's field does, so an agent sending 400 gets 40", async () => {
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const call = async (name: string, args: Record<string, unknown>) =>
        (await client.callTool({ name: `airdesign_${name}`, arguments: args })).structuredContent as Record<string, any>
      const made = await call("create_deck", { name: "Angle" })
      const edited = await call("edit_deck", {
        deck: made.deck,
        base: made.rev,
        changes: [
          {
            op: "add",
            kind: "shape",
            slide: made.slides[0],
            fill: { gradient: ["accent1", "accent2"], angle: 400 },
          },
        ],
      })
      expect(edited).toMatchObject({ ok: true })
      expect((await call("read_deck", { deck: made.deck })).layers).toContain("@40)")
    })
  })
})

describe("link addresses over the protocol", () => {
  it("accepts mailto addresses with or without a query and refuses bare mailto queries and over-limit URLs", async () => {
    const betweenLimits = `https://example.com/${"a".repeat(2_000)}`
    let minted = 0
    const session: Session = { agent: "aira", mint: () => `link${String((minted += 1))}`, log: emptyLog(), now: 0 }
    await withClient(session, memoryDecks(started), async (client) => {
      const call = async (name: string, args: Record<string, unknown>) =>
        client.callTool({ name: `airdesign_${name}`, arguments: args })
      const made = (await call("create_deck", { name: "Links" })).structuredContent as {
        deck: string
        rev: number
        slides: string[]
      }
      const target = `${made.slides[0]!}.title`
      let rev = made.rev
      for (const link of ["mailto:a@b.c", "mailto:a@b.c?subject=x"]) {
        const landed = await call("edit_deck", {
          deck: made.deck,
          base: rev,
          changes: [{ op: "set", target, text: `[contact](${link})` }],
        })
        expect(landed.isError).not.toBe(true)
        expect(landed.structuredContent).toMatchObject({ ok: true })
        rev = (landed.structuredContent as { rev: number }).rev
        const read = (await call("read_deck", { deck: made.deck })).structuredContent as { layers: string }
        expect(read.layers).toContain(`[contact](${link})`)
      }
      const bareMailto = await call("edit_deck", {
        deck: made.deck,
        base: rev,
        changes: [{ op: "set", target, text: "[contact](mailto:?x)" }],
      })
      expect(bareMailto.isError).toBe(true)
      expect(bareMailto.structuredContent).toMatchObject({ ok: false, refusal: "field", refused: "shape" })
      const tooLong = await call("edit_deck", {
        deck: made.deck,
        base: rev,
        changes: [{ op: "set", target, text: `[contact](${betweenLimits})` }],
      })
      expect(tooLong.isError).toBe(true)
      expect(tooLong.structuredContent).toMatchObject({ ok: false, refusal: "limit", refused: "limit" })
    })
  })
})

describe("a rotation past a full turn", () => {
  it("wraps over the protocol as the canvas's rotate stores it, so an agent sending -90 gets 270", async () => {
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const call = async (name: string, args: Record<string, unknown>) =>
        (await client.callTool({ name: `airdesign_${name}`, arguments: args })).structuredContent as Record<string, any>
      const made = await call("create_deck", { name: "Turn" })
      const edited = await call("edit_deck", {
        deck: made.deck,
        base: made.rev,
        changes: [{ op: "add", kind: "shape", slide: made.slides[0], rotation: -90 }],
      })
      expect(edited).toMatchObject({ ok: true })
      expect((await call("read_deck", { deck: made.deck })).layers).toContain("r=270")
    })
  })

  it("keeps a wrapped rotation when an add with textStyle title fills the slide's title placeholder", async () => {
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const call = async (name: string, args: Record<string, unknown>) =>
        (await client.callTool({ name: `airdesign_${name}`, arguments: args })).structuredContent as Record<string, any>
      const made = await call("create_deck", { name: "Turn" })
      const edited = await call("edit_deck", {
        deck: made.deck,
        base: made.rev,
        changes: [
          { op: "add", kind: "text", slide: made.slides[0], text: "Turned", textStyle: "title", rotation: -90 },
        ],
      })
      expect(edited).toMatchObject({ ok: true })
      expect((await call("read_deck", { deck: made.deck })).layers).toContain("r=270")
    })
  })
})

describe("an answer read from structuredContent alone", () => {
  const shot = "/9j/AAAA"
  const textOf = (result: { content: unknown }) =>
    (result.content as { type: string; text?: string }[]).filter((block) => block.type === "text")

  it("carries every word the tool says, as a client that reads only structuredContent needs", async () => {
    const host: Host = {
      ...memoryDecks(started),
      pictures: async (_deck, _fold, slides) => new Map(slides.map((slide) => [slide, shot])),
    }
    await withClient(sessionFor(), host, async (client) => {
      const call = (name: string, args: Record<string, unknown>) =>
        client.callTool({ name: `airdesign_${name}`, arguments: args })
      const made = await call("create_deck", { name: "Board" })
      const deck = (made.structuredContent as { deck: string }).deck
      const first = (made.structuredContent as { slides: string[] }).slides[0]!
      const read = await call("read_deck", { deck, picture: true })
      const edited = await call("edit_deck", {
        deck,
        base: (read.structuredContent as { rev: number }).rev,
        changes: [{ op: "add", kind: "text", slide: first, text: "Plan" }],
      })
      const runId = (edited.structuredContent as { runId: string }).runId
      const answers = {
        made,
        read,
        edited,
        listed: await call("list_decks", {}),
        stopped: await call("stop_run", { deck, runId }),
        unknown: await call("read_deck", { deck: "nothere" }),
        wrong: await call("edit_deck", { deck, base: 1, changes: [{ op: "set", node: "z:9", fill: 3 }] }),
      }
      for (const result of Object.values(answers))
        expect(textOf(result)).toEqual([{ type: "text", text: JSON.stringify(result.structuredContent) }])

      const seen = read.structuredContent as { note: string; layers: string; pictures: string[] }
      expect(seen.note).toContain("Send rev as base to airdesign_edit_deck.")
      expect(seen.layers.split("\n")[0]).toMatch(new RegExp(`^slide ${first} "Title" group=\\S+$`))
      expect(seen.layers).toContain('text="Untitled"')
      expect(seen.pictures).toEqual([first])
      expect(read.content).toContainEqual({ type: "image", data: shot, mimeType: "image/jpeg" })
      expect((made.structuredContent as { layers: string }).layers).toContain('text="Untitled"')
      expect((edited.structuredContent as { note: string }).note).toMatch(/^Landed at rev \d+, adding \S+ text/)
      expect((answers.stopped.structuredContent as { note: string }).note).toBe("The run has stopped.")
      expect(answers.unknown.structuredContent).toEqual({
        ok: false,
        refusal: "deck",
        note: "This session can reach no deck with this id. airdesign_list_decks lists the decks you own.",
      })
      expect((answers.wrong.structuredContent as { note: string }).note).toMatch(/^Change 1 \(set\)/)
    })
  })

  it("says in structuredContent which slides have no picture yet", async () => {
    const host: Host = { ...memoryDecks(started), pictures: async () => new Map() }
    await withClient(sessionFor(), host, async (client) => {
      const made = await client.callTool({ name: "airdesign_create_deck", arguments: {} })
      const { deck, slides } = made.structuredContent as { deck: string; slides: string[] }
      const read = await client.callTool({ name: "airdesign_read_deck", arguments: { deck, picture: true } })
      const seen = read.structuredContent as { note: string; pictures?: string[] }
      expect(seen.note).toContain(`No current picture of slide ${slides[0]!}`)
      expect(seen.pictures).toBeUndefined()
      expect(textOf(read)).toEqual([{ type: "text", text: JSON.stringify(read.structuredContent) }])
    })
  })
})

describe("a host that admits each tool call", () => {
  it("is asked for every call, and a refusal answers the host's text and changes nothing", async () => {
    const decks = memoryDecks(started)
    const asked: number[] = []
    const text = "Ninety tool calls in five minutes. The next tool call can run in 12 seconds." as const
    const host: Host = {
      ...decks,
      admit: async (seen) => {
        asked.push(seen.now)
        return asked.length === 1
          ? { ok: true, log: emptyLog() }
          : { ok: false, log: emptyLog(), text, resetsAt: 12_000 }
      },
    }
    await withClient(sessionFor(), host, async (client) => {
      const made = await client.callTool({ name: "airdesign_create_deck", arguments: {} })
      expect(made.isError).not.toBe(true)
      const refused = await client.callTool({ name: "airdesign_create_deck", arguments: {} })
      expect(refused.isError).toBe(true)
      expect(refused.structuredContent).toEqual({ ok: false, refusal: "rate", note: text })
    })
    expect(asked).toEqual([0, 0])
    expect(decks.decks.size).toBe(1)
  })

  it("answers a store refusal when the host cannot admit a call", async () => {
    const decks = memoryDecks(started)
    const host: Host = { ...decks, admit: () => Promise.reject(new Error("connect ECONNREFUSED")) }
    await withClient(sessionFor(), host, async (client) => {
      const refused = await client.callTool({ name: "airdesign_create_deck", arguments: {} })
      expect(refused.isError).toBe(true)
      expect(refused.structuredContent).toMatchObject({ ok: false, refusal: "store" })
    })
    expect(decks.decks.size).toBe(0)
  })

  it("counts calls in the session's own log when the host does not admit", async () => {
    const session = sessionFor()
    await withClient(session, memoryDecks(started), async (client) => {
      for (let call = 0; call < 90; call += 1) {
        const listed = await client.callTool({ name: "airdesign_list_decks", arguments: {} })
        expect(listed.isError).not.toBe(true)
      }
      const refused = await client.callTool({ name: "airdesign_list_decks", arguments: {} })
      expect(refused.isError).toBe(true)
      expect(refused.structuredContent).toMatchObject({
        refusal: "rate",
        note: "Ninety tool calls in five minutes. The next tool call can run in 300 seconds.",
      })
    })
  })
})
