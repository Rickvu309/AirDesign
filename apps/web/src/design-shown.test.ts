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
import { colorNameCopy } from "@/copy/color-name-copy"
import { shownHex } from "@/design/color-choices"
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
    { command: "person", node, v: format, patch: { fills: { p0: { set: { solid: color } } } } },
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
  it("names the slide, its background from the master, and every template color", async () => {
    const parts = await fixture("blank.pptx")
    const shown = designShown(parts, 0)
    expect(shown?.slide).toBe(readSlides(parts)[0]?.slide)
    expect(shown?.number).toBe(1)
    expect(shown?.background.name).toBe(colorNameCopy.white)
    expect(shown?.background.value).toEqual({ scheme: "lt1" })
    expect(shown?.background.css).toBe(shown?.templateColors.find((color) => color.scheme === "lt1")?.css)
    expect(shown?.templateColors.map((color) => color.name)).toEqual([
      colorNameCopy.black,
      colorNameCopy.white,
      colorNameCopy.darkBlue,
      colorNameCopy.numbered(colorNameCopy.white, 2),
      colorNameCopy.blue,
      colorNameCopy.orange,
      colorNameCopy.green,
      colorNameCopy.purple,
      colorNameCopy.red,
      colorNameCopy.teal,
    ])
  })

  it("shows a colour set on the slide by its template color name, a tint by its hex, and an RGB colour by its hex", async () => {
    const parts = await fixture("blank.pptx")
    const accent = designShown(painted(parts, { scheme: "accent2" }), 0)
    expect(accent?.background.name).toBe(colorNameCopy.orange)
    expect(accent?.background.value).toEqual({ scheme: "accent2" })
    const tint: Color = {
      scheme: "accent1",
      transforms: [
        { op: "lumMod", val: 60_000 },
        { op: "lumOff", val: 40_000 },
      ],
    }
    const tinted = designShown(painted(parts, tint), 0)
    expect(tinted?.background.name).toBe(`#${shownHex(tint, tinted?.templateColors ?? [])}`)
    expect(tinted?.background.value).toEqual(tint)
    const navy = designShown(painted(parts, { rgb: "0F2433" }), 0)
    expect(navy?.background.css.slice(1)).toBe("0F2433")
    expect(navy?.background.name).toBe(navy?.background.css)
    expect(navy?.background.value).toEqual({ rgb: "0F2433" })
  })

  it("names a background that is not one colour, and shows nothing past the last slide", async () => {
    const parts = await fixture("doe-heat-pumps.pptx")
    const named = readSlides(parts).map((_, index) => designShown(parts, index)?.background.name)
    expect(named.every((name) => typeof name === "string" && name.length > 0)).toBe(true)
    expect(designShown(parts, readSlides(parts).length)).toBeNull()
  })
})
