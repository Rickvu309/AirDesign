import {
  decide,
  elementId,
  format,
  openRegister,
  slideId,
  type Color,
  type Command,
  type Register,
} from "@airdesign/document"
import { readParts, readSlides } from "@airdesign/pptx"
import { describe, expect, it } from "vitest"
import { designShown } from "@/design-shown"
import { exportedParts } from "@/exported-parts"

async function fixture(name: string) {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

function painted(parts: ReadonlyMap<string, Uint8Array>, color: Color) {
  const file = readSlides(parts).map((each) => slideId(each.slide))
  const node = elementId(`${file[0] ?? ""}.slide`)
  const commands: readonly Command[] = [
    { command: "add", node, floor: "", route: "deck" },
    { command: "person", node, v: format, patch: { fill: { value: { set: { solid: color } } } } },
  ]
  const register = commands.reduce<Register>(
    (current, command) => {
      const decision = decide(current, command)
      if (decision.decision === "refuse") throw new Error(decision.code)
      return decision.register
    },
    { ...openRegister("", "deck"), file },
  )
  return exportedParts(parts, register)
}

describe("design shown", () => {
  it("names the slide, its background from the master, and every theme colour, with the background's colour chosen", async () => {
    const parts = await fixture("blank.pptx")
    const shown = designShown(parts, 0)
    expect(shown?.slide).toBe(readSlides(parts)[0]?.slide)
    expect(shown?.number).toBe(1)
    expect(shown?.background.name).toBe("Light 1")
    expect(shown?.background.css).toBe(shown?.colors.find((color) => color.scheme === "lt1")?.css)
    expect(shown?.colors.map((color) => color.name)).toEqual([
      "Dark 1",
      "Light 1",
      "Dark 2",
      "Light 2",
      "Accent 1",
      "Accent 2",
      "Accent 3",
      "Accent 4",
      "Accent 5",
      "Accent 6",
    ])
    expect(shown?.colors.filter((color) => color.chosen).map((color) => color.scheme)).toEqual(["lt1"])
  })

  it("shows a colour set on the slide, and an RGB colour by its hex", async () => {
    const parts = await fixture("blank.pptx")
    const accent = designShown(painted(parts, { scheme: "accent2" }), 0)
    expect(accent?.background.name).toBe("Accent 2")
    expect(accent?.colors.filter((color) => color.chosen).map((color) => color.scheme)).toEqual(["accent2"])
    const navy = designShown(painted(parts, { rgb: "0F2433" }), 0)
    expect(navy?.background.css.slice(1)).toBe("0F2433")
    expect(navy?.background.name).toBe(navy?.background.css)
    expect(navy?.colors.some((color) => color.chosen)).toBe(false)
  })

  it("names a background that is not one colour, and shows nothing past the last slide", async () => {
    const parts = await fixture("doe-heat-pumps.pptx")
    const named = readSlides(parts).map((_, index) => designShown(parts, index)?.background.name)
    expect(named.every((name) => typeof name === "string" && name.length > 0)).toBe(true)
    expect(designShown(parts, readSlides(parts).length)).toBeNull()
  })
})
