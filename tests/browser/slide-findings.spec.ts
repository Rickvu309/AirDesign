import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import {
  findingLimits,
  layText,
  slideFindings,
  type Finding,
  type ResolvedElement,
  type ResolvedSlide,
  type SlideFindings,
} from "../../packages/document/src/index.ts"
import { agreementTable, openDeck, showSlide, within, worst, type Row } from "./fit-truth.ts"
import { paintedHeights, slideWidths } from "./font-widths.ts"
import { keptWait, keptWaitApproval } from "./kept-wait"

const point = 12_700
const truthDecks = ["doe-heat-pumps.pptx", "nasa-cots-parts-nesc.pptx", "census-updating-spm.pptx"]

test.use({ viewport: { width: 1600, height: 1000 } })

type Deck = { readonly name: string; readonly path: string; readonly slides: readonly ResolvedSlide[] }

function readDecks(): readonly Deck[] {
  const run = spawnSync(process.execPath, [join(process.cwd(), "tests/browser/fixture-slides.mts")], {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  })
  if (run.status !== 0) throw new Error(run.stderr || "could not read the fixture decks")
  return JSON.parse(run.stdout) as Deck[]
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

test("findings over every fixture deck, counted by kind and timed with no device", async ({ page }) => {
  const decks = await readDecks()
  await page.goto("/")
  const widths = await slideWidths(
    page,
    decks.flatMap((deck) => deck.slides),
  )
  const totals = new Map<string, number>()
  const reasons = new Map<string, number>()
  const flagged: string[] = []
  const lines = ["| deck | slides | ms, median of 5 | findings |", "| --- | --- | --- | --- |"]
  let judged = 0
  for (const deck of decks) {
    const times: number[] = []
    let results: readonly SlideFindings[] = deck.slides.map((slide) => slideFindings(slide, widths))
    for (let round = 0; round < 5; round += 1) {
      const start = performance.now()
      results = deck.slides.map((slide) => slideFindings(slide, widths))
      times.push(performance.now() - start)
    }
    const counts = new Map<string, number>()
    for (const [at, result] of results.entries()) {
      for (const finding of result.findings) {
        const kind = counted(finding)
        counts.set(kind, (counts.get(kind) ?? 0) + 1)
        totals.set(kind, (totals.get(kind) ?? 0) + 1)
        flagged.push(`${deck.name} slide ${at + 1} ${finding.code} ${finding.node} ${JSON.stringify(finding)}`)
      }
      for (const { reason } of result.unjudged) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
      judged +=
        deck.slides[at]?.elements.filter((element) => element.from === "slide" && element.text !== null).length ?? 0
    }
    lines.push(
      `| ${deck.name} | ${deck.slides.length} | ${median(times).toFixed(1)} | ${[...counts].map(([kind, count]) => `${kind} ${count}`).join(", ")} |`,
    )
    if (deck.slides.length >= 41) expect(median(times), deck.name).toBeLessThan(50)
  }
  console.log(lines.join("\n"))
  console.log(`totals: ${[...totals].map(([kind, count]) => `${kind} ${count}`).join(", ")}`)
  console.log(
    `text elements on slides: ${judged}; not judged: ${[...reasons].map(([reason, count]) => `${reason} ${count}`).join(", ") || "none"}`,
  )
  console.log(flagged.join("\n"))
})

function counted(finding: Finding): string {
  return `${finding.code} (${finding.level})`
}

function shapeOf(element: ResolvedElement): string {
  const paragraphs = element.text?.paragraphs ?? []
  if ((element.text?.fontScale ?? 1) < 1 || (element.text?.lineReduction ?? 0) > 0) return "shrunk"
  if (paragraphs.some((paragraph) => new Set(paragraph.runs.map((run) => `${run.font} ${run.size}`)).size > 1))
    return "mixed"
  if (paragraphs.some((paragraph) => paragraph.bullet !== null)) return "bullets"
  return "plain"
}

test("text fit agrees with the painter on the text of real decks", async ({ page }) => {
  test.setTimeout(
    keptWait(3 * 60_000, {
      why: "lays out the text of every real deck against the painter, about 20 seconds on ci",
      until: "2027-02-18",
      approval: keptWaitApproval,
    }),
  )
  const decks = (await readDecks()).filter((deck) => truthDecks.includes(deck.name))
  const rows: Row[] = []
  const verdicts = { agree: 0, missed: 0, alarms: 0 }
  for (const deck of decks) {
    await openDeck(page, deck.name, readFileSync(deck.path))
    const captured: {
      readonly at: number
      readonly element: ResolvedElement
      readonly truth: number
    }[] = []
    for (const [at, slide] of deck.slides.entries()) {
      await showSlide(page, at + 1)
      const boxes = slide.elements.flatMap((element) => {
        if (element.from !== "slide" || element.text === null || element.box === null || element.rotation !== 0)
          return []
        if (!element.text.paragraphs.some((paragraph) => paragraph.runs.some((run) => run.text !== ""))) return []
        return [{ element, key: element.node, width: element.box.cx / point }]
      })
      if (boxes.length === 0) continue
      await page.locator(`[data-slide-paint] [data-canvas-element="${boxes[0]?.key ?? ""}"]`).waitFor()
      const heights = await paintedHeights(page, boxes)
      for (const [index, { element }] of boxes.entries()) {
        const truth = heights[index]
        if (truth === null || truth === undefined) continue
        captured.push({ at, element, truth })
      }
    }
    const widths = await slideWidths(page, deck.slides)
    for (const { at, element, truth } of captured) {
      if (element.text === null || element.box === null) continue
      const laid = layText(element.text, element.box, widths)
      if (typeof laid === "string") continue
      rows.push({
        group: shapeOf(element),
        truth,
        said: laid.height,
        label: `${deck.name} slide ${at + 1} ${element.node}`,
      })
      const real = truth > laid.room + findingLimits.overflow
      const said = laid.height > laid.room + findingLimits.overflow
      if (real === said) verdicts.agree += 1
      else if (real) verdicts.missed += 1
      else verdicts.alarms += 1
    }
  }
  console.log(`text fit against the painter on ${truthDecks.join(", ")}\n${agreementTable(rows)}\n${worst(rows, 12)}`)
  console.log(
    `taller than its box: agrees ${verdicts.agree} of ${rows.length}, missed ${verdicts.missed}, false alarms ${verdicts.alarms}`,
  )
  expect(within(rows, "plain", 1)).toBeGreaterThanOrEqual(0.9)
})
