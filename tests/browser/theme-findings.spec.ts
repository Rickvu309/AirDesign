import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { test } from "./deck-test"
import { slideFindings, type ResolvedSlide } from "../../packages/document/src/index.ts"
import { slideWidths } from "./font-widths.ts"

type Themed = { readonly before: readonly ResolvedSlide[]; readonly after: readonly ResolvedSlide[] }

function themedSlides(deck: string, slot: string, hex: string): Themed {
  const run = spawnSync(process.execPath, [join(process.cwd(), "tests/browser/theme-slides.mts"), deck, slot, hex], {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  })
  if (run.status !== 0) throw new Error(run.stderr || "could not paint the themed deck")
  return JSON.parse(run.stdout) as Themed
}

test("a theme colour that matches the background raises low contrast on the slides whose text names it", async ({
  page,
}) => {
  const { before, after } = themedSlides("doe-heat-pumps.pptx", "dk1", "FFFFFF")
  await page.goto("/")
  const widths = await slideWidths(page, [...before, ...after])
  const lowContrast = (slides: readonly ResolvedSlide[]) =>
    slides.flatMap((slide) => slideFindings(slide, widths).findings.filter((each) => each.code === "low-contrast"))
  const was = lowContrast(before)
  const now = lowContrast(after)
  const raised = now.filter((finding) => !was.some((each) => each.node === finding.node))
  expect(raised.length).toBeGreaterThan(0)
  expect(new Set(raised.map((finding) => finding.slide)).size).toBeGreaterThan(1)
  expect(raised.every((finding) => finding.code === "low-contrast" && finding.text === "FFFFFF")).toBe(true)
})
