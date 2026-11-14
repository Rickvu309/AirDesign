import { slideId, type SlideCommand } from "@airdesign/document"
import { orderedParts, readParts, readSlides } from "@airdesign/pptx"
import { describe, expect, it } from "vitest"
import { designShown } from "@/design-shown"

async function fixture(name: string) {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

function painted(parts: ReadonlyMap<string, Uint8Array>, order: readonly SlideCommand[]) {
  return orderedParts(parts, { file: readSlides(parts).map((each) => slideId(each.slide)), order })
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
    const id = slideId(readSlides(parts)[0]!.slide)
    const accent = designShown(painted(parts, [{ slide: "background", id, color: { scheme: "accent2" } }]), 0)
    expect(accent?.background.name).toBe("Accent 2")
    expect(accent?.colors.filter((color) => color.chosen).map((color) => color.scheme)).toEqual(["accent2"])
    const navy = designShown(painted(parts, [{ slide: "background", id, color: { rgb: "0F2433" } }]), 0)
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
