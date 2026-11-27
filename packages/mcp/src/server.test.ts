import { catalog, onceMeta, projectTools } from "@airdesign/catalog"
import { bytesOf } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"

import { createServer, type DeckHost, type Session } from "./index.js"
import { scriptOf } from "./testing/change-script.js"
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
  let minted = 0
  return { agent: "aira", mint: () => `minted${String((minted += 1))}` }
}

async function withClient(session: Session, host: DeckHost, use: (client: Client) => Promise<void>): Promise<void> {
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

  it("lists six tools within the listing ceiling", async () => {
    const projected = projectTools(catalog)
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      expect(client.getServerVersion()?.name).toBe("airdesign")
      const { tools } = await client.listTools()
      const listedTokens = Math.ceil(bytesOf(JSON.stringify(await client.listTools())) / 4)
      expect(tools.map((tool) => tool.name)).toEqual([
        "airdesign_execute",
        "airdesign_get_app_state",
        "airdesign_get_style",
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
      const execute = tools.find((tool) => tool.name === "airdesign_execute")!
      expect(execute.inputSchema).toMatchObject({ required: ["script"] })
      expect(Object.keys((execute.inputSchema as { properties: object }).properties)).toEqual([
        "deck",
        "script",
        "runId",
      ])
      expect(listedTokens).toBeLessThanOrEqual(Math.ceil(826 * 1.05))
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
      const made = await call("execute", { script: 'createDeck({ name: "Replace" })' })
      const deck = made.deck as string
      const [first] = made.slides as string[]
      const add = { op: "slide", add: {} }
      const gone = { op: "slide", delete: first }
      const none = await call("execute", { deck, script: scriptOf([gone]) })
      expect(none).toMatchObject({ ok: false, refusal: "last-slide", op: 1, verb: "remove" })
      const deleteFirst = await call("execute", { deck, script: scriptOf([gone, add]) })
      expect(deleteFirst).toMatchObject({ ok: true })
      const slidesOf = async () => (await call("execute", { deck, script: "get().slides" })).result as string[]
      const [second] = await slidesOf()
      expect(await slidesOf()).toHaveLength(1)
      const addFirst = await call("execute", { deck, script: scriptOf([add, { op: "slide", delete: second }]) })
      expect(addFirst).toMatchObject({ ok: true })
      expect(await slidesOf()).toHaveLength(1)
    })
  })

  it("builds the board deck brief in four calls over the protocol", async () => {
    const decks = memoryDecks(started)
    await withClient(sessionFor(), decks, async (client) => {
      const call = async (name: string, args: unknown) => {
        const result = await client.callTool({ name: `airdesign_${name}`, arguments: args as Record<string, unknown> })
        expect(result.isError, JSON.stringify(result.content)).not.toBe(true)
        return result.structuredContent as Record<string, any>
      }
      const made = await call("execute", { script: 'createDeck({ name: "Board" })' })
      const deck = made.deck as string
      const filled = await call("execute", {
        deck,
        script: `
          const [first] = get().slides
          const [two, three, four, five] = [1, 2, 3, 4].map(() => insert({ kind: "slide" }))
          insert({ parent: first, kind: "text", text: "Q3 board update", textStyle: "title" })
          insert({ parent: two, kind: "text", text: "$4.2M" })
          insert({ parent: three, kind: "shape", name: "Revenue", fill: "accent1" })
          insert({ parent: four, kind: "icon", icon: "trending-up" })
          insert({ parent: five, kind: "frame", rows: [["", "Q1"], ["Product", "Beta"]] })
          get().slides.length
        `,
      })
      expect(filled).toMatchObject({ ok: true, result: 5, names: { Revenue: expect.any(String) } })
      await call("stop_run", { deck, runId: filled.runId })
      expect((await call("execute", { deck, script: "get().layers" })).result).toContain('name="Revenue"')
    })
  })

  it("takes the once an agent names in the call's meta, and refuses one in the wrong form", async () => {
    const decks = memoryDecks(started)
    await withClient(sessionFor(), decks, async (client) => {
      const once = (value: unknown) => ({ _meta: { [onceMeta]: value } })
      const first = await client.callTool({
        name: "airdesign_execute",
        arguments: { script: "createDeck()" },
        ...once("make-1"),
      })
      const again = await client.callTool({
        name: "airdesign_execute",
        arguments: { script: "createDeck()" },
        ...once("make-1"),
      })
      expect(again.structuredContent).toEqual(first.structuredContent)
      expect(decks.decks.size).toBe(1)
      const bad = await client.callTool({
        name: "airdesign_execute",
        arguments: { script: "createDeck()" },
        ...once("not allowed!"),
      })
      expect(bad.isError).toBe(true)
      expect(bad.structuredContent).toMatchObject({ ok: false, refusal: "field" })
    })
  })

  it("answers a refusal as an error with the answer as its structured content", async () => {
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const refused = await client.callTool({
        name: "airdesign_execute",
        arguments: { deck: "nothere", script: "get()" },
      })
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
      const made = await call("execute", { script: 'createDeck({ name: "Angle" })' })
      const edited = await call("execute", {
        deck: made.deck,
        script: scriptOf([
          {
            op: "add",
            kind: "shape",
            slide: made.slides[0],
            fill: { gradient: ["accent1", "accent2"], angle: 400 },
          },
        ]),
      })
      expect(edited).toMatchObject({ ok: true })
      expect((await call("execute", { deck: made.deck, script: "get().layers" })).result).toContain("@40)")
    })
  })
})

describe("link addresses over the protocol", () => {
  it("accepts mailto addresses with or without a query and refuses bare mailto queries and over-limit URLs", async () => {
    const betweenLimits = `https://example.com/${"a".repeat(2_000)}`
    let minted = 0
    const session: Session = { agent: "aira", mint: () => `link${String((minted += 1))}` }
    await withClient(session, memoryDecks(started), async (client) => {
      const call = async (name: string, args: Record<string, unknown>) =>
        client.callTool({ name: `airdesign_${name}`, arguments: args })
      const made = (await call("execute", { script: 'createDeck({ name: "Links" })' })).structuredContent as {
        deck: string
        slides: string[]
      }
      const target = `${made.slides[0]!}.title`
      const set = (text: string) => ({ deck: made.deck, script: scriptOf([{ op: "set", target, text }]) })
      for (const link of ["mailto:a@b.c", "mailto:a@b.c?subject=x"]) {
        const landed = await call("execute", set(`[contact](${link})`))
        expect(landed.isError).not.toBe(true)
        expect(landed.structuredContent).toMatchObject({ ok: true })
        const read = (await call("execute", { deck: made.deck, script: "get().layers" })).structuredContent as {
          result: string
        }
        expect(read.result).toContain(`[contact](${link})`)
      }
      const bareMailto = await call("execute", set("[contact](mailto:?x)"))
      expect(bareMailto.isError).toBe(true)
      expect(bareMailto.structuredContent).toMatchObject({ ok: false, refusal: "field", refused: "shape" })
      const tooLong = await call("execute", set(`[contact](${betweenLimits})`))
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
      const made = await call("execute", { script: 'createDeck({ name: "Turn" })' })
      const edited = await call("execute", {
        deck: made.deck,
        script: scriptOf([{ op: "add", kind: "shape", slide: made.slides[0], rotation: -90 }]),
      })
      expect(edited).toMatchObject({ ok: true })
      expect((await call("execute", { deck: made.deck, script: "get().layers" })).result).toContain("r=270")
    })
  })

  it("keeps a wrapped rotation when an add with textStyle title fills the slide's title placeholder", async () => {
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const call = async (name: string, args: Record<string, unknown>) =>
        (await client.callTool({ name: `airdesign_${name}`, arguments: args })).structuredContent as Record<string, any>
      const made = await call("execute", { script: 'createDeck({ name: "Turn" })' })
      const edited = await call("execute", {
        deck: made.deck,
        script: scriptOf([
          { op: "add", kind: "text", slide: made.slides[0], text: "Turned", textStyle: "title", rotation: -90 },
        ]),
      })
      expect(edited).toMatchObject({ ok: true })
      expect((await call("execute", { deck: made.deck, script: "get().layers" })).result).toContain("r=270")
    })
  })
})

describe("an answer read from structuredContent alone", () => {
  const shot = "/9j/AAAA"
  const textOf = (result: { content: unknown }) =>
    (result.content as { type: string; text?: string }[]).filter((block) => block.type === "text")

  it("carries every word the tool says, as a client that reads only structuredContent needs", async () => {
    const host: DeckHost = {
      ...memoryDecks(started),
      pictures: async (_deck, _fold, slides) => new Map(slides.map((slide) => [slide, shot])),
    }
    await withClient(sessionFor(), host, async (client) => {
      const call = (name: string, args: Record<string, unknown>) =>
        client.callTool({ name: `airdesign_${name}`, arguments: args })
      const made = await call("execute", { script: 'createDeck({ name: "Board" })' })
      const deck = (made.structuredContent as { deck: string }).deck
      const first = (made.structuredContent as { slides: string[] }).slides[0]!
      const read = await call("execute", { deck, script: `screenshot({ target: "${first}" }); get().layers` })
      const edited = await call("execute", {
        deck,
        script: scriptOf([{ op: "add", kind: "text", slide: first, text: "Plan" }]),
      })
      const runId = (edited.structuredContent as { runId: string }).runId
      const answers = {
        made,
        read,
        edited,
        listed: await call("get_app_state", {}),
        stopped: await call("stop_run", { deck, runId }),
        unknown: await call("execute", { deck: "nothere", script: "get()" }),
        wrong: await call("execute", { deck, script: 'update({ target: "z:9", fill: 3 })' }),
      }
      for (const result of Object.values(answers))
        expect(textOf(result)).toEqual([{ type: "text", text: JSON.stringify(result.structuredContent) }])

      const seen = read.structuredContent as { note: string; result: string; pictures: string[] }
      expect(seen.note).toContain("only read the deck")
      expect(seen.result.split("\n")[0]).toMatch(new RegExp(`^slide ${first} "Title" group=\\S+$`))
      expect(seen.result).toContain('text="Untitled"')
      expect(seen.pictures).toEqual([first])
      expect(read.content).toContainEqual({ type: "image", data: shot, mimeType: "image/jpeg" })
      expect((made.structuredContent as { layers: string }).layers).toContain('text="Untitled"')
      expect((edited.structuredContent as { note: string }).note).toMatch(/^Landed at rev \d+ as one undo step\./)
      expect((answers.stopped.structuredContent as { note: string }).note).toBe("The run has stopped.")
      expect(answers.unknown.structuredContent).toEqual({
        ok: false,
        refusal: "deck",
        note: "This session can reach no deck with this id. airdesign_get_app_state lists the decks you own.",
      })
      expect((answers.wrong.structuredContent as { note: string }).note).toMatch(
        /^Nothing landed\. Operation 1 \(update\) at line 1: /,
      )
    })
  })

  it("says in structuredContent that no tab is open to paint a picture", async () => {
    const host: DeckHost = { ...memoryDecks(started), pictures: async () => "unwatched" }
    await withClient(sessionFor(), host, async (client) => {
      const made = await client.callTool({ name: "airdesign_execute", arguments: { script: "createDeck()" } })
      const { deck, slides } = made.structuredContent as { deck: string; slides: string[] }
      const read = await client.callTool({
        name: "airdesign_execute",
        arguments: { deck, script: `screenshot({ target: "${slides[0]!}" })` },
      })
      const seen = read.structuredContent as { note: string; pictures?: string[] }
      expect(seen.note).toContain("none is open")
      expect(seen.pictures).toBeUndefined()
      expect(textOf(read)).toEqual([{ type: "text", text: JSON.stringify(read.structuredContent) }])
    })
  })
})

describe("a host that admits each tool call and each deck", () => {
  it("is asked for every call and every deck, and a refusal answers the host's text and changes nothing", async () => {
    const decks = memoryDecks(started)
    const asked: string[] = []
    const text = "Ninety tool calls in five minutes. The next tool call can run in 12 seconds."
    const host: DeckHost = {
      ...decks,
      admit: async (kind) => {
        asked.push(kind)
        return asked.length <= 2 ? { ok: true } : { ok: false, text }
      },
    }
    await withClient(sessionFor(), host, async (client) => {
      const made = await client.callTool({ name: "airdesign_execute", arguments: { script: "createDeck()" } })
      expect(made.isError).not.toBe(true)
      const refused = await client.callTool({ name: "airdesign_execute", arguments: { script: "createDeck()" } })
      expect(refused.isError).toBe(true)
      expect(refused.structuredContent).toEqual({ ok: false, refusal: "rate", note: text })
    })
    expect(asked).toEqual(["tool", "deck", "tool"])
    expect(decks.decks.size).toBe(1)
  })

  it("makes no deck when the host refuses the deck", async () => {
    const decks = memoryDecks(started)
    const text = "Five decks in one minute. The next deck can open in 20 seconds."
    const host: DeckHost = { ...decks, admit: async (kind) => (kind === "deck" ? { ok: false, text } : { ok: true }) }
    await withClient(sessionFor(), host, async (client) => {
      const refused = await client.callTool({ name: "airdesign_execute", arguments: { script: "createDeck()" } })
      expect(refused.isError).toBe(true)
      expect(refused.structuredContent).toEqual({ ok: false, refusal: "rate", note: text })
    })
    expect(decks.decks.size).toBe(0)
  })

  it("answers a store refusal when the host cannot admit a call", async () => {
    const decks = memoryDecks(started)
    const host: DeckHost = { ...decks, admit: () => Promise.reject(new Error("connect ECONNREFUSED")) }
    await withClient(sessionFor(), host, async (client) => {
      const refused = await client.callTool({ name: "airdesign_execute", arguments: { script: "createDeck()" } })
      expect(refused.isError).toBe(true)
      expect(refused.structuredContent).toMatchObject({ ok: false, refusal: "store" })
    })
    expect(decks.decks.size).toBe(0)
  })
})
