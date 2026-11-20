import { readDeckId } from "@airdesign/catalog"
import { elementId, writeTextValue } from "@airdesign/document"
import { indexDeck, openDeck } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type NamedImage, type Session } from "./index.js"

const size = { width: 12_192_000, height: 6_858_000 }
const box = { x: 1_524_000, y: 1_122_363, cx: 9_144_000, cy: 2_387_600 }
const logo = "https://images.example.com/logo.png"
const media = { sha256: "a".repeat(64), type: "image/png" } as const

function session(images: ReadonlyMap<string, NamedImage>): Session {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const title = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }])
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 1,
      slides: [{ id: "256", position: 0, size, free: 5, animated: [], layout: [] }],
      elements: [{ node: elementId("256.2"), kind: "shape", value: title, box, grouped: false }],
    },
  )
  if (!indexed.ok) throw new Error(indexed.refusal)
  return {
    deck: indexed.deck,
    caller: { actor: "agent", runId: "run" },
    now: 0,
    turns: memoryTurns(),
    log: emptyLog(),
    images,
  }
}

async function edited(held: Session, changes: readonly unknown[]) {
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    return await client.callTool({ name: "airdesign_edit_deck", arguments: { deck: "deck", base: 0, changes } })
  } finally {
    await client.close()
    await server.close()
  }
}

function text(result: Awaited<ReturnType<typeof edited>>): string {
  const content = result.content as readonly { readonly text: string }[]
  return content.map((block) => block.text).join("\n")
}

describe("an agent adds an image from the web", () => {
  it("adds the fetched image as a shape whose media is the stored file, whole inside the box it names", async () => {
    const held = session(new Map([[logo, { ok: true, media, width: 400, height: 100 }]]))
    const answer = await edited(held, [
      { op: "add", kind: "shape", slide: "256", image: logo, box: { x: 72, y: 72, w: 288, h: 144 } },
    ])
    expect(answer.isError).not.toBe(true)
    expect(held.deck.register.order.at(-1)).toEqual({
      slide: "element-add",
      id: "256",
      element: {
        node: "256.5",
        kind: "shape",
        value: null,
        box: { x: 914_400, y: 1_371_600, cx: 3_657_600, cy: 914_400 },
        grouped: false,
      },
      media,
      runId: "run",
    })
  })

  it("sizes an image with no box at 96 pixels an inch in the slide's free space", async () => {
    const held = session(new Map([[logo, { ok: true, media, width: 480, height: 320 }]]))
    expect((await edited(held, [{ op: "add", kind: "shape", slide: "256", image: logo }])).isError).not.toBe(true)
    const added = held.deck.register.order.at(-1)
    expect(added?.slide === "element-add" ? added.element.box : null).toMatchObject({ cx: 4_572_000, cy: 3_048_000 })
  })

  it("refuses the whole call and says why when an image could not be fetched", async () => {
    const held = session(new Map([[logo, { ok: false, refusal: "private" }]]))
    const answer = await edited(held, [
      { op: "add", kind: "shape", slide: "256", text: { value: "Hi" } },
      { op: "add", kind: "shape", slide: "256", image: logo },
      { op: "add", kind: "shape", slide: "256", image: "https://images.example.com/other.png" },
    ])
    expect(answer.isError).toBe(true)
    expect(text(answer)).toContain(`Change 2: "${logo}" was not used because it leads to a private or local network`)
    expect(text(answer)).toContain("Change 3: ")
    expect(held.deck.register.order.at(-1)?.slide).not.toBe("element-add")
  })

  it("refuses an address that is not https before anything is fetched", async () => {
    const answer = await edited(session(new Map()), [
      { op: "add", kind: "shape", slide: "256", image: "http://images.example.com/logo.png" },
    ])
    expect(answer.isError).toBe(true)
    expect(text(answer)).toContain("Change 1: image is missing or has the wrong form.")
  })
})
