import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { entry, fixtures, manySlides, openGrid, groupNumbers } from "./slide-grid-deck"
import { decksOn, test } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const readout = (page: Page) => page.locator("[data-zoom-readout]")

async function faceGap(page: Page, from: number, to: number): Promise<number> {
  const [start, next] = await Promise.all([entry(page, from).boundingBox(), entry(page, to).boundingBox()])
  if (start === null || next === null) throw new Error("bounds")
  return next.y - (start.y + start.height)
}

async function openTwelve(page: Page) {
  await decksOn(page).open({
    name: "twelve-sections.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(
      24,
      Array.from({ length: 12 }, () => 2),
      Array.from({ length: 12 }, (_, group) => `Section ${String(group + 1)}`),
    ),
  })
  await openGrid(page)
}

test("twelve two-slide sections fit at 5% with a gap and no heading", async ({ page }) => {
  await openTwelve(page)
  expect(await groupNumbers(page)).toHaveLength(12)
  await expect(readout(page)).toHaveText("5%")
  await expect(page.locator("[data-group-head]")).toHaveCount(0)
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
  await expect(page.locator("[data-section-name]")).toHaveCount(0)
  const groups = page.locator("[data-slide-group]")
  await expect(groups).toHaveCount(12)
  await expect(groups.nth(2)).toHaveAccessibleName("Section 3")
  const last = await entry(page, 24).boundingBox()
  const room = await page.locator("[data-grid-viewport]").boundingBox()
  if (last === null || room === null) throw new Error("bounds")
  expect(last.y + last.height).toBeLessThanOrEqual(room.y + room.height)
  await expect(entry(page, 5)).toBeVisible()
})

test("the heat-pump deck fits at 11% and a wrapped group's lines sit closer than the next group", async ({
  page,
  decks,
}) => {
  await decks.open(join(fixtures, "doe-heat-pumps.pptx"))
  await openGrid(page)
  await expect(readout(page)).toHaveText("11%")
  await expect(page.locator("[data-group-head]")).toHaveCount(0)
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
  const groups = page.locator("[data-slide-group]")
  await expect(groups).toHaveCount(4)
  await expect(groups.nth(0)).toHaveAccessibleName("Introduction")
  await expect(groups.nth(1)).toHaveAccessibleName(/^Part 1:/)
  await expect(groups.nth(3)).toHaveAccessibleName("Appendices")
  const within = await faceGap(page, 2, 12)
  const between = await faceGap(page, 22, 30)
  expect(within).toBeCloseTo(16.6, 0)
  expect(between).toBeCloseTo(48.5, 0)
  expect(between).toBeGreaterThan(within * 2)
  await page.locator("[data-zoom-readout]").click()
  const field = page.locator("[data-zoom-field]")
  await field.fill("25")
  await field.press("Enter")
  await expect(readout(page)).toHaveText(/^25/)
  const withinQuarter = await faceGap(page, 2, 12)
  const betweenQuarter = await faceGap(page, 22, 30)
  expect(withinQuarter).toBeCloseTo(37.2, 0)
  expect(betweenQuarter).toBeCloseTo(108.7, 0)
  expect(betweenQuarter).toBeGreaterThan(withinQuarter * 2)
})

test("six slides in two sections fit at 31%", async ({ page, decks }) => {
  await decks.open({
    name: "six-sections.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(6, true),
  })
  await openGrid(page)
  await expect(readout(page)).toHaveText("31%")
  expect(await groupNumbers(page)).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ])
  await expect(page.locator("[data-slide-group]").first()).toHaveAccessibleName("Opening")
  await expect(page.locator("[data-slide-group]").last()).toHaveAccessibleName("Results")
  await expect(page.locator("[data-group-head]")).toHaveCount(0)
})

test("an unsectioned six-slide deck fits at 23% with four slides on the first line", async ({ page, decks }) => {
  await decks.open({
    name: "six.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(6),
  })
  await openGrid(page)
  await expect(readout(page)).toHaveText("23%")
  expect(await groupNumbers(page)).toEqual([[1, 2, 3, 4, 5, 6]])
  const tops = await Promise.all(
    [1, 2, 3, 4, 5, 6].map(async (number) => Math.round((await entry(page, number).boundingBox())!.y)),
  )
  expect(new Set(tops.slice(0, 4)).size).toBe(1)
  expect(new Set(tops.slice(4)).size).toBe(1)
  expect(tops[4]).toBeGreaterThan(tops[0]!)
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
  await expect(page.locator("[data-group-head]")).toHaveCount(0)
})
