import { expect, it } from "vitest"
import type { CanvasBullet, CanvasParagraph, CanvasRunStyle, CanvasText } from "./record.js"
import { restyle, textLook } from "./text-look.js"

const scaled = (emu: number) => (emu * 800) / 12_192_000
const run: CanvasRunStyle = { font: "Serifa", size: 254_000, bold: false, italic: false, color: "rgb(1, 2, 3)" }
const dot: CanvasBullet = { char: "•", font: "Arial", color: null, size: null }
const dash: CanvasBullet = { char: "–", font: "Arial", color: null, size: null }
const letters: CanvasBullet = { autoNumber: "alphaLcParenR", number: 1, start: 1, font: null, color: null, size: null }

function item(from: number, overrides: Partial<CanvasParagraph> = {}): CanvasParagraph {
  return {
    from,
    align: "left",
    marginLeft: 228_600,
    indent: -228_600,
    bullet: dot,
    runs: [{ from: 0, text: "Item", ...run }],
    endStyle: run,
    ...overrides,
  }
}

function placeholder(
  paragraphs: readonly CanvasParagraph[],
  templateBullets?: CanvasText["templateBullets"],
): CanvasText {
  return {
    paragraphs,
    ...(templateBullets === undefined ? {} : { templateBullets }),
    anchor: "top",
    insets: { left: 0, top: 0, right: 0, bottom: 0 },
    wrap: true,
  }
}

function bullets(text: CanvasText, levels: readonly (string | undefined)[]): readonly string[] {
  const host = document.createElement("div")
  levels.forEach((level, from) => {
    const block = document.createElement("div")
    block.dataset.paragraph = String(from)
    if (level !== undefined) block.dataset.level = level
    const span = document.createElement("span")
    span.dataset.run = `${from}.0`
    span.textContent = "Item"
    block.append(span)
    host.append(block)
  })
  restyle(host, textLook(text, scaled))
  return [...host.children].map((block) => (block as HTMLElement).style.getPropertyValue("--bullet"))
}

it("shows the template's bullet for the level a placeholder item is tabbed to", () => {
  const text = placeholder([item(0)], [dot, dash, dot])
  expect(bullets(text, ["1"])).toEqual(['"–"'])
  expect(bullets(text, ["2"])).toEqual(['"•"'])
})

it("keeps a bullet the paragraph holds of its own", () => {
  const own: CanvasBullet = { char: "✓", font: null, color: null, size: null }
  expect(bullets(placeholder([item(0, { bullet: own, ownBullet: true })], [dot, dash]), ["1"])).toEqual(['"✓"'])
})

it("numbers a tabbed item with the template level's own numbering", () => {
  const text = placeholder([item(0), item(1), item(2)], [dot, letters])
  expect(bullets(text, ["1", "1", undefined])).toEqual(['"a)"', '"b)"', '"•"'])
})

it("takes the template level's bullet over a number the item had from its old level", () => {
  const numbered: CanvasBullet = {
    autoNumber: "arabicPeriod",
    number: 1,
    start: 1,
    font: null,
    color: null,
    size: null,
  }
  expect(bullets(placeholder([item(0, { bullet: numbered })], [numbered, dash]), ["1"])).toEqual(['"–"'])
})

it("keeps a text box's bullet on Tab, since it has no template", () => {
  expect(bullets(placeholder([item(0)]), ["1"])).toEqual(['"•"'])
})
