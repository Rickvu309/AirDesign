import * as doom from "@airdesign/doom"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { installIndexedDb, traffic } from "./browser-fixtures.js"
import { deleteDatabase } from "./device.js"
import { deviceStorage } from "./doom-storage.js"

const person: doom.Author = { kind: "person", id: "tab" }
const box = (x: number) => ({ x, y: 20, w: 300, h: 100, rotation: 0, flipH: false, flipV: false })

function boardOf(slides: number) {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: Array.from({ length: slides }, (_, slide) => ({
      children: Array.from({ length: 10 }, (_, shape) => ({
        type: "shape" as const,
        name: `${String(slide)}.${String(shape)}`,
        props: { box: box(10) },
      })),
    })),
  })
}

function landed(fold: doom.Doom, once: string, writes: readonly doom.Write[]): doom.Doom {
  const next = doom.applyEdit(fold, { once, author: person, writes, rev: doom.rev(fold.rev + 1) })
  if (doom.isRefusal(next)) throw new Error(JSON.stringify(next))
  return next
}

async function writtenByOneEdit(slides: number) {
  const grown = boardOf(slides)
  const storage = deviceStorage(`cost${String(slides)}`)
  await storage.write({ fold: grown.doom, queue: [] })
  const moved = landed(grown.doom, "move", [{ node: grown.ids["1.1"]!, prop: "box", value: box(50) }])
  const before = { ...traffic }
  await storage.write({ fold: moved })
  return { puts: traffic.puts - before.puts, bytes: traffic.bytes - before.bytes, moved }
}

describe("what one landed edit writes to the device", () => {
  beforeEach(installIndexedDb)
  afterEach(deleteDatabase)

  it("is the same on a 40-slide deck as on a 5-slide deck", async () => {
    const small = await writtenByOneEdit(5)
    const large = await writtenByOneEdit(40)
    expect(large.puts).toBe(small.puts)
    expect(large.bytes).toBeLessThan(small.bytes * 1.2)
    expect(large.bytes).toBeLessThan(2_000)
  })

  it("reopens as the fold it wrote", async () => {
    const { moved } = await writtenByOneEdit(5)
    expect(doom.foldToJson((await deviceStorage("cost5").read())!.fold!)).toEqual(doom.foldToJson(moved))
  })

  it("writes the whole fold again when another tab wrote an older one in between", async () => {
    const grown = boardOf(2)
    const first = landed(grown.doom, "one", [{ node: grown.ids["0.0"]!, prop: "name", value: "One" }])
    const second = landed(first, "two", [{ node: grown.ids["1.0"]!, prop: "name", value: "Two" }])
    const ahead = deviceStorage("tabs")
    const behind = deviceStorage("tabs")
    await ahead.write({ fold: first })
    await behind.write({ fold: grown.doom })
    await ahead.write({ fold: second })
    expect(doom.foldToJson((await deviceStorage("tabs").read())!.fold!)).toEqual(doom.foldToJson(second))
  })
})
