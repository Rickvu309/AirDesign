import { describe, expect, it } from "vitest"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import * as pptx from "./index.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"

const touchedSlide = "ppt/slides/slide1.xml"
const untouchedSlide = "ppt/slides/slide2.xml"
const smallRun = '<a:rPr lang="en-US" sz="400"><a:latin typeface="Calibri"/></a:rPr>'
const fixture = `${process.cwd()}/scripts/pptx-fixtures/tall-glyph-before.pptx`
const routeJudge = `${process.cwd()}/scripts/pptx-route-judge.mjs`

type ScoredRow = { readonly parts?: boolean; readonly errors?: number; readonly dupes?: number } | null
type RouteJudge = {
  scoreWrittenRoute(
    pptx: unknown,
    beforeParts: ReadonlyMap<string, Uint8Array>,
    beforeErrors: readonly string[],
    item: unknown,
    afterErrors: readonly string[],
  ): ScoredRow
}

function withSmallText(parts: ReadonlyMap<string, Uint8Array>, value: string): Map<string, Uint8Array> {
  const slide = parts.get(untouchedSlide)
  if (slide === undefined) throw new Error(untouchedSlide)
  const xml = decodeUtf8(slide).replace(
    /<a:rPr lang="en-US" sz="2400"[^>]*>.*?<\/a:rPr><a:t>[^<]*<\/a:t>/,
    `${smallRun}<a:t>${value}</a:t>`,
  )
  const next = new Map(parts)
  next.set(untouchedSlide, encodeUtf8(xml))
  return next
}

function editedFirstSlide(parts: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  const slide = parts.get(touchedSlide)
  if (slide === undefined) throw new Error(touchedSlide)
  const next = new Map(parts)
  next.set(touchedSlide, encodeUtf8(decodeUtf8(slide).replace("<a:t>Hello</a:t>", "<a:t>Hello!</a:t>")))
  return next
}

async function scored(afterSmallText: string): Promise<ScoredRow> {
  const judge = (await import(routeJudge)) as RouteJudge
  const deck = await pptx.readParts(readFileSync(fixture))
  const before = withSmallText(deck, "Costs 1.5 per unit")
  const back = editedFirstSlide(withSmallText(deck, afterSmallText))
  const item = {
    run: { operation: "text.replace", error: null, touch: { changed: [touchedSlide], added: [], removed: [] } },
    exportError: null,
    back,
  }
  return judge.scoreWrittenRoute(pptx, before, [], item, [])
}

describe("judging a written route", () => {
  it("accepts a route that changed only the part it declared", async () => {
    expect(await scored("Costs 1.5 per unit")).toBeNull()
  })

  it("refuses a one-character swap at 4 pt in a slide the route did not touch", async () => {
    const row = await scored("Costs 1,5 per unit")
    expect(row).toMatchObject({ parts: false, errors: 0, dupes: 0 })
  })
})
