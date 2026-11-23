import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import { FontMetrics } from "./font-metrics.js"
import { FontSource } from "./font-source.js"

const family = "Liberation Sans Narrow"
const line = "Revenue grew 12% to $48.2M"
const canvas = { regular: 11.03173828125, bold: 11.39453125, kernAV: -0.06005859375 }

const widthOf = (face: doom.FontFace, words: string) =>
  [...words].reduce(
    (sum, char, at) => sum + (face.advances[char] ?? 0) + (at === 0 ? 0 : (face.kerning?.[words[at - 1]! + char] ?? 0)),
    0,
  )

it("reads a served face's advances and pair kerning as Chromium's canvas measures them", async () => {
  const metrics = new FontMetrics(new FontSource(undefined))
  const widths = await metrics.widths({
    faces: [
      { font: family, bold: false, italic: false },
      { font: family, bold: true, italic: false },
    ],
    texts: [line, "AV"],
  })
  const regular = widths?.[doom.fontFace(family, false, false)]!
  const bold = widths?.[doom.fontFace(family, true, false)]!
  expect(widthOf(regular, line)).toBeCloseTo(canvas.regular, 4)
  expect(widthOf(bold, line)).toBeCloseTo(canvas.bold, 4)
  expect(regular.kerning?.AV).toBeCloseTo(canvas.kernAV, 4)
  expect(regular.ascent).toBeGreaterThan(0)
})

it("measures a deck's words with its theme fonts, so a fixed box too short for them is found", async () => {
  const theme = { ...doom.defaultTheme, fonts: { heading: family, body: family } }
  const grown = doom.doomFromTree({
    theme,
    slides: [
      {
        children: [
          {
            type: "shape",
            name: "title",
            props: {
              box: { x: 100, y: 100, w: 600, h: 100, rotation: 0, flipH: false, flipV: false },
              text: { ...doom.textFromMarkdown(line, "title"), resize: "fixed" },
            },
          },
        ],
      },
    ],
  })
  const measure = await new FontMetrics(new FontSource(undefined)).measure(grown.doom)
  expect(measure).toBeDefined()
  const findings = doom.layoutFindings(grown.doom, grown.slides, measure!)
  expect(findings).toMatchObject([{ code: "overflow", node: grown.ids.title, room: 100 }])
})

it("answers no measure when a deck's font cannot be served, so the layout goes unchecked", async () => {
  const theme = { ...doom.defaultTheme, fonts: { heading: "No Such Font", body: family } }
  const grown = doom.doomFromTree({ theme, slides: [{ children: [] }] })
  expect(await new FontMetrics(new FontSource(undefined)).measure(grown.doom)).toBeUndefined()
})
