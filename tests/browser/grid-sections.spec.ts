import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { entry, fixtures, openGrid, groupNumbers } from "./slide-grid-deck"
import { test } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const heatPumps = join(fixtures, "doe-heat-pumps.pptx")

async function faceGap(page: Page, from: number, to: number): Promise<number> {
  const [start, next] = await Promise.all([entry(page, from).boundingBox(), entry(page, to).boundingBox()])
  if (start === null || next === null) throw new Error("bounds")
  return next.y - (start.y + start.height)
}

test("named groups stay fully shown and are announced without a heading or a rule", async ({ page, decks }) => {
  await decks.open(join(fixtures, "sections-after.pptx"))
  await openGrid(page)
  await expect(page.locator("[data-editor-grid] [data-group-head]")).toHaveCount(0)
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
  const groups = page.locator("[data-slide-group]")
  await expect(groups).toHaveCount(2)
  await expect(groups.first()).toHaveAccessibleName("Opening")
  await expect(groups.last()).toHaveAccessibleName("Numbers")
  await expect(entry(page, 1)).toBeVisible()
  await expect(entry(page, 2)).toBeVisible()
  await expect(entry(page, 3)).toBeVisible()
})

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1470, height: 923 },
]) {
  test(`each heat-pump group is one block told apart by spacing at ${viewport.width}px`, async ({ page, decks }) => {
    await page.setViewportSize(viewport)
    await decks.open(heatPumps)
    await openGrid(page)
    expect((await groupNumbers(page)).map((row) => row.length)).toEqual([1, 28, 10, 2])
    await expect(page.locator("[data-editor-grid] [data-group-head]")).toHaveCount(0)
    await expect(page.locator("[data-group-rule]")).toHaveCount(0)
    const groups = page.locator("[data-slide-group]")
    await expect(groups).toHaveCount(4)
    await expect(groups.nth(0)).toHaveAccessibleName("Introduction")
    await expect(groups.nth(3)).toHaveAccessibleName("Appendices")
    const within = await faceGap(page, 2, 12)
    const between = await faceGap(page, 22, 30)
    expect(between).toBeGreaterThan(within * 2)
    if (viewport.width === 1470) await expect(page.locator("[data-zoom-readout]")).toHaveText("11%")
  })
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1470, height: 923 },
]) {
  test(`short sections each take their own line at ${viewport.width}px`, async ({ page, decks }) => {
    await page.setViewportSize(viewport)
    await decks.open(join(fixtures, "sections-after.pptx"))
    await openGrid(page)
    await expect(page.locator("[data-grid-group]")).toHaveCount(2)
    await expect(page.locator("[data-slide-group]")).toHaveCount(2)
    const first = await entry(page, 1).boundingBox()
    const next = await entry(page, 2).boundingBox()
    if (first === null || next === null) throw new Error("slides")
    expect(first.x).toBeCloseTo(next.x)
    expect(first.y + first.height).toBeLessThan(next.y)
  })
}

test("a group collapsed in the filmstrip still shows every slide in Grid", async ({ page, decks }) => {
  await decks.open(join(fixtures, "sections-after.pptx"))
  const opening = page.locator("button[data-group-head]").first()
  await expect(opening).toHaveAttribute("aria-expanded", "true")
  await opening.click()
  await expect(opening).toHaveAttribute("aria-expanded", "false")
  await expect(page.locator("[data-slide-item]")).toHaveCount(2)
  await openGrid(page)
  await expect(page.locator("[data-editor-grid] [data-group-head]")).toHaveCount(0)
  await expect(entry(page, 1)).toBeVisible()
  await expect(entry(page, 2)).toBeVisible()
  await expect(entry(page, 3)).toBeVisible()
  await page.getByRole("button", { name: slideListCopy.listName, exact: true }).click()
  await expect(page.locator("[data-editor-grid]")).toHaveCount(0)
  await expect(page.locator("button[data-group-head]").first()).toBeVisible()
  await expect(entry(page, 1)).toBeVisible()
})
