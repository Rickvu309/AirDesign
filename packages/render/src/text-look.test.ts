import { expect, it } from "vitest"
import type { CanvasParagraph, CanvasRunStyle, CanvasText } from "./record.js"
import { restyle, textLook } from "./text-look.js"

const hash = "#"
const wide = 12_192_000
const canvas = 800
const scaled = (emu: number) => (emu * canvas) / wide
const margin = 285_750
const font = 254_000

const run: CanvasRunStyle = {
  font: "Serifa",
  size: font,
  bold: false,
  italic: false,
  underline: true,
  strike: true,
  baseline: 0.3,
  color: "rgb(1, 2, 3)",
  highlight: "rgb(9, 8, 7)",
}

function paragraph(overrides: Partial<CanvasParagraph> = {}): CanvasText {
  return {
    paragraphs: [
      {
        from: 0,
        align: "left",
        marginLeft: margin,
        indent: -margin,
        lineSpacing: { percent: 0.9 },
        spaceBefore: { length: 63_500 },
        spaceAfter: { percent: 0.2 },
        bullet: { char: "•", font: "Serifa", color: "rgb(4, 5, 6)", size: 0.8 },
        runs: [{ from: 0, text: "Item", ...run }],
        endStyle: { ...run, underline: false, strike: false, baseline: 0, highlight: null },
        ...overrides,
      },
    ],
    anchor: "top",
    insets: { left: 0, top: 0, right: 0, bottom: 0 },
    wrap: true,
  }
}

function painted(text: CanvasText, words = "Item") {
  const host = document.createElement("div")
  const block = document.createElement("div")
  block.dataset.paragraph = "0"
  const span = document.createElement("span")
  span.dataset.run = "0.0"
  if (words !== "") span.textContent = words
  block.append(span)
  if (words === "") block.append(document.createElement("br"))
  host.append(block)
  restyle(host, textLook(text, scaled))
  const marked = block.querySelector("span")
  if (marked === null) throw new Error("no run")
  return { block, run: marked }
}

it("paints a hanging bullet, the gaps around a paragraph, and the marks on a run", () => {
  const { block, run: paintedRun } = painted({ ...paragraph(), edgeSpacing: true })
  expect(Number.parseFloat(block.style.paddingLeft)).toBeCloseTo(scaled(margin), 4)
  expect(Number.parseFloat(block.style.textIndent)).toBeCloseTo(scaled(-margin), 4)
  expect(Number.parseFloat(block.style.marginTop)).toBeCloseTo(scaled(63_500), 4)
  expect(Number.parseFloat(block.style.marginBottom)).toBeCloseTo(scaled(font * 0.2), 4)
  expect(block.style.lineHeight).toBe("0")
  expect(block.style.getPropertyValue("--bullet")).toBe('"•"')
  expect(Number.parseFloat(block.style.getPropertyValue("--bullet-hang"))).toBeCloseTo(scaled(margin), 4)
  expect(Number.parseFloat(block.style.getPropertyValue("--bullet-size"))).toBeCloseTo(scaled(font * 0.8), 4)
  expect(block.style.getPropertyValue("--bullet-color")).toBe("rgb(4, 5, 6)")
  expect(block.textContent).toBe("Item")
  expect(paintedRun.style.lineHeight).toBe("1.08")
  expect(paintedRun.style.textDecoration).toBe("underline line-through")
  expect(paintedRun.style.backgroundColor).toBe("rgb(9, 8, 7)")
  expect(paintedRun.style.verticalAlign).toBe("0.3em")
})

it("numbers a list and keeps an exact line spacing on an empty paragraph", () => {
  const text = paragraph({
    lineSpacing: { length: 127_000 },
    bullet: { autoNumber: "alphaLcParenR", number: 2, font: null, color: null, size: null },
    runs: [],
  })
  const { block } = painted(text, "")
  expect(Number.parseFloat(block.style.lineHeight)).toBeCloseTo(scaled(127_000), 4)
  expect(block.style.getPropertyValue("--bullet")).toBe('"b)"')
  expect(Number.parseFloat(block.style.getPropertyValue("--bullet-hang"))).toBeCloseTo(scaled(margin), 4)
  expect(block.textContent).toBe("")
})

it("prints roman numerals and a positive indent has no hang", () => {
  const { block, run: paintedRun } = painted(
    paragraph({
      indent: margin,
      lineSpacing: null,
      spaceBefore: null,
      spaceAfter: null,
      bullet: { autoNumber: "romanUcPeriod", number: 4, font: null, color: null, size: null },
      runs: [{ from: 0, text: "Item", ...run, underline: false, strike: false, baseline: -0.25, highlight: null }],
    }),
  )
  expect(Number.parseFloat(block.style.textIndent)).toBeCloseTo(scaled(margin), 4)
  expect(block.style.getPropertyValue("--bullet")).toBe('"IV."')
  expect(block.style.getPropertyValue("--bullet-hang")).toBe("")
  expect(paintedRun.style.lineHeight).toBe("1.2")
  expect(paintedRun.style.verticalAlign).toBe("-0.25em")
  expect(paintedRun.style.textDecoration).toBe("")
})

it("marks a paragraph that ends in a line break so its empty last line paints at the run's line height", () => {
  const ended = painted(paragraph(), "Item\n").block
  const plain = painted(paragraph(), "Item").block
  expect(ended.hasAttribute("data-end-break")).toBe(true)
  expect(ended.style.getPropertyValue("--end-line")).toBe("1.08")
  expect(plain.hasAttribute("data-end-break")).toBe(false)
})

it("spaces lines by a share of PowerPoint's single line, which is 1.2 times the font size", () => {
  expect(painted(paragraph({ lineSpacing: { percent: 0.9 } })).run.style.lineHeight).toBe("1.08")
  expect(painted(paragraph({ lineSpacing: { percent: 1.5 } })).run.style.lineHeight).toBe("1.8")
  expect(painted(paragraph({ lineSpacing: null })).run.style.lineHeight).toBe("1.2")
  expect(painted(paragraph({ lineSpacing: { percent: 0.9 }, runs: [] }), "").block.style.lineHeight).toBe("1.08")
  expect(painted(paragraph({ lineSpacing: null, runs: [] }), "").block.style.lineHeight).toBe("1.2")
})

it.each([
  ["Calibri", "Carlito"],
  ["Calibri Light", "Carlito"],
  ["calibri", "Carlito"],
  ["Cambria", "Caladea"],
  ["Arial", "Arimo"],
  ["Helvetica", "Arimo"],
  ["Times New Roman", "Tinos"],
])("follows %s with %s, an open font of the same widths", (font, twin) => {
  const text = paragraph({
    bullet: { char: "•", font, color: null, size: null },
    runs: [{ from: 0, text: "Item", ...run, font }],
  })
  const { block, run: paintedRun } = painted(text)
  expect(paintedRun.style.fontFamily).toBe(`"${font}", "${twin}", var(--font-sans)`)
  expect(block.style.getPropertyValue("--bullet-font")).toBe(`"${font}", "${twin}", var(--font-sans)`)
})

it("follows a font with no open twin with the page font alone", () => {
  expect(painted(paragraph()).run.style.fontFamily).toBe('"Serifa", var(--font-sans)')
})

it("paints a theme tint and shade a person picks before the file has them", () => {
  const text = { ...paragraph(), colors: [{ scheme: "accent1", css: "rgb(68, 114, 196)" }] } as const
  const look = textLook(text, scaled)
  const tint = {
    scheme: "accent1",
    transforms: [
      { op: "lumMod", val: 60_000 },
      { op: "lumOff", val: 40_000 },
    ],
  } as const
  expect(look.run(0, 0, { color: tint }).color).toBe(`${hash}8FAADC`)
  expect(look.run(0, 0, { color: { scheme: "accent1", transforms: [{ op: "lumMod", val: 75_000 }] } }).color).toBe(
    `${hash}2F5597`,
  )
})

it("leaves out the space before the first paragraph and after the last unless the body keeps them", () => {
  const two = (edgeSpacing: boolean): CanvasText => {
    const text = paragraph()
    const first = text.paragraphs[0]!
    return { ...text, paragraphs: [first, { ...first, from: 1 }], ...(edgeSpacing ? { edgeSpacing } : {}) }
  }
  const gaps = (text: CanvasText) => {
    const look = textLook(text, scaled)
    return [0, 1].map((from) => {
      const style = look.paragraph(from, true)
      return [style.marginTop !== undefined, style.marginBottom !== undefined]
    })
  }
  expect(gaps(two(false))).toEqual([
    [false, true],
    [true, false],
  ])
  expect(gaps(two(true))).toEqual([
    [true, true],
    [true, true],
  ])
})
