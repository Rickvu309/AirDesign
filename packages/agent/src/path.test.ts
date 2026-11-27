import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { callTool, type Session } from "./index.js"
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

describe("paths through execute", () => {
  it("adds and sets path geometry, and reads commands only for the requested layer", async () => {
    let sequence = 0
    const session = { ...sessionFor(), mint: () => `path-${++sequence}` }
    const host = memoryDecks(started)
    const call = async (name: string, args: Record<string, unknown>) =>
      (await callTool(`airdesign_${name}`, args, session, host)).fields as Record<string, unknown>
    const made = await call("execute", { script: 'createDeck({ name: "Paths" })' })
    const deck = made?.deck
    const slides = made?.slides
    if (!Array.isArray(slides)) throw new Error("Expected a slide")
    const slide = slides[0]
    const box = { x: 15, y: 20, w: 100, h: 100 }
    const d = "M0 0L1 1".padEnd(4000)
    const path = { op: "add", kind: "path", slide, d, box, fillStroke: true }
    const edit = (...changes: readonly object[]) => call("execute", { deck, script: scriptOf(changes) })
    const read = async (target: unknown) =>
      (await call("execute", { deck, script: `get({ target: ${JSON.stringify(target)} })` })).result as {
        layers: string
      }
    expect(await edit({ ...path, d: d + "Z" })).toMatchObject({ ok: false, field: "d" })
    expect(await edit({ ...path, d: undefined })).toMatchObject({ ok: false, field: "d" })
    const added = await edit(path, { ...path, d: "M0 1L1 0" })
    expect(added?.ok).toBe(true)
    const summary = await read(slide)
    expect(summary.layers).toContain("path @15,20 100x100")
    expect(summary.layers).toContain("fillStroke=true")
    expect(summary.layers).not.toContain("d=")
    const madeIds = added?.made
    if (!Array.isArray(madeIds)) throw new Error("Expected added layers")
    const target = madeIds[0].ids[0]
    const detail = await read(target)
    expect(detail.layers).toContain(`d="${d}"`)
    expect(detail.layers).not.toContain('d="M0 1L1 0"')
    const set = await edit({ op: "set", target, fillStroke: false, d: "M0 0L1 0L1 1Z" })
    expect(set?.ok).toBe(true)
    expect((await read(target)).layers).toContain('fillStroke=false d="M0 0L1 0L1 1Z"')
  })
})
