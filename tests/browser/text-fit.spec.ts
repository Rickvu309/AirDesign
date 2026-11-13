import { expect, test, type Page } from "@playwright/test"
import { layText, type FontWidths, type ResolvedText } from "../../packages/document/src/index.ts"
import { fitCases, fitDeck, placeCases, type FitGroup, type PlacedCase } from "./fit-deck.ts"
import { measureFaces, paintedFamilies, paintedHeights } from "./font-widths.ts"
import { agreementTable, openDeck, overflowAgreement, showSlide, within, worst, zoomTo, type Row } from "./fit-truth.ts"

const point = 12_700
const counts: Record<FitGroup, number> = { plain: 400, spacing: 120, bullets: 160, mixed: 160, marks: 160 }
const groups = Object.keys(counts) as FitGroup[]

test.use({ viewport: { width: 1600, height: 1000 } })

function predicted(text: ResolvedText, width: number, widths: FontWidths): number | null {
  const laid = layText(text, { cx: Math.round(width * point), cy: 500 * point }, widths)
  return typeof laid === "string" ? null : laid.height
}

async function compare(page: Page, placed: readonly PlacedCase[], zoom: string | null): Promise<readonly Row[]> {
  await openDeck(page, "fit.pptx", await fitDeck(placed))
  if (zoom !== null) await zoomTo(page, zoom)
  const painted = new Map<string, number>()
  const families = new Set<string>()
  const slides = Math.max(...placed.map((item) => item.slide))
  for (let slide = 1; slide <= slides; slide += 1) {
    await showSlide(page, slide)
    const here = placed.filter((item) => item.slide === slide)
    await page.locator(`[data-slide-paint] [data-canvas-element="${here[0]?.key ?? ""}"]`).waitFor()
    const heights = await paintedHeights(page, here)
    for (const [at, item] of here.entries()) {
      const height = heights[at]
      if (height !== null && height !== undefined) painted.set(item.key, height)
    }
    for (const family of await paintedFamilies(page)) families.add(family)
  }
  const chars = placed
    .flatMap((item) =>
      item.text.paragraphs.flatMap((paragraph) => [
        ...paragraph.runs.map((run) => run.text),
        paragraph.bullet?.text ?? "",
      ]),
    )
    .join("")
  const widths = await measureFaces(page, [...families], `${chars}x`)
  const rows = placed.map((item) => ({
    group: item.group,
    truth: painted.get(item.key) ?? Number.NaN,
    said: predicted(item.text, item.width, widths),
    label: `${item.key} w=${item.width} ${item.text.paragraphs[0]?.runs[0]?.font} ${item.text.paragraphs[0]?.runs[0]?.size}pt`,
  }))
  expect(rows.filter((row) => Number.isNaN(row.truth))).toEqual([])
  return rows
}

test("text fit lays text out as the painter does where sizes fall on whole pixels", async ({ page }) => {
  test.setTimeout(20 * 60_000)
  const rows = await compare(page, placeCases(fitCases(counts, 3)), "100%")
  console.log(`text fit against the painter at 100%, sizes on a 3 pt grid\n${agreementTable(rows)}\n${worst(rows, 8)}`)
  for (const group of groups) {
    expect(overflowAgreement(rows.filter((row) => row.group === group)), group).toBeGreaterThanOrEqual(0.99)
    expect(within(rows, group, 1), group).toBeGreaterThanOrEqual(group === "mixed" ? 0.9 : 0.98)
  }
})

test("text fit agrees with the painter on overflow at the zoom that fits the slide", async ({ page }) => {
  test.setTimeout(20 * 60_000)
  const rows = await compare(page, placeCases(fitCases(counts)), null)
  console.log(
    `text fit against the painter at fit zoom, any whole point size\n${agreementTable(rows)}\n${worst(rows, 8)}`,
  )
  for (const group of groups) {
    expect(overflowAgreement(rows.filter((row) => row.group === group)), group).toBeGreaterThanOrEqual(0.98)
    expect(within(rows, group, 1), group).toBeGreaterThanOrEqual(group === "mixed" ? 0.85 : 0.95)
  }
})
