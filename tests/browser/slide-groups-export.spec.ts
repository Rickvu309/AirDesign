import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { savedExport } from "./export-dialog"
import { grab, hover, openSaved, zoomTo } from "./grid-reorder-deck"
import { fixtures } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const partOne = "Part 1: Basic Principles of Heat Pump Operation"
const partTwo = "Part 2: System Design Options/Considerations"
const handle = (page: Page, group: number) =>
  page.getByRole("button", { name: slideListCopy.moveRow(group), exact: true })
const addBelow = (page: Page, group: number) =>
  page.getByRole("button", { name: slideListCopy.addBelow(group), exact: true })

test("a person regroups the heat-pump deck in Grid and the exported file lists those slide groups as its sections", async ({
  page,
  context,
  stack,
}, testInfo) => {
  const saved = await openSaved(page, context, stack, join(fixtures, "doe-heat-pumps.pptx"))
  const lengths = async () => (await saved.rows()).map((group) => group.length)
  await expect.poll(lengths).toEqual([1, 28, 10, 2])

  await grab(page, 30)
  await hover(page, 29, 0.8)
  await page.mouse.up()
  await expect.poll(lengths).toEqual([1, 29, 9, 2])
  expect((await saved.rows())[1]?.at(-1)).toBe(saved.ids[29])

  await zoomTo(page, 25)
  await addBelow(page, 1).focus()
  await page.keyboard.press("Enter")
  await expect.poll(lengths).toEqual([1, 1, 29, 9, 2])

  await handle(page, 5).focus()
  await page.keyboard.press("Alt+ArrowUp")
  await expect.poll(lengths).toEqual([1, 1, 29, 2, 9])

  const file = testInfo.outputPath("regrouped.pptx")
  await savedExport(page, file)
  const { readParts, readSections, sectionListFailures } = await import("../../packages/pptx/src/index.ts")
  const parts = await readParts(new Uint8Array(await readFile(file)))
  expect(sectionListFailures(parts)).toEqual([])
  expect(readSections(parts).map((section) => `${section.name} ${String(section.slides.length)}`)).toEqual([
    "Introduction 1",
    "Untitled Section 1",
    `${partOne} 29`,
    "Appendices 2",
    `${partTwo} 9`,
  ])
  const groups = await saved.rows()
  const exported = readSections(parts).map((section) => section.slides)
  for (const at of [0, 2, 3, 4]) expect(exported[at]).toEqual(groups[at])
})

test("dragging a slide group's first slide to its third line keeps one group and exports the same section", async ({
  page,
  context,
  stack,
}, testInfo) => {
  const saved = await openSaved(page, context, stack, join(fixtures, "doe-heat-pumps.pptx"))
  const lengths = async () => (await saved.rows()).map((group) => group.length)
  await expect.poll(lengths).toEqual([1, 28, 10, 2])
  const before = (await saved.rows())[1] ?? []

  await grab(page, 2)
  await hover(page, 24, 0.75)
  await page.mouse.up()
  await expect.poll(async () => (await saved.rows())[1]?.[0]).toBe(saved.ids[2])
  expect(await lengths()).toEqual([1, 28, 10, 2])
  expect((await saved.rows())[1]?.indexOf(saved.ids[1] ?? "")).toBe(22)
  const groups = page.locator("[data-slide-group]")
  await expect(groups).toHaveCount(4)
  await expect(groups.nth(0)).toHaveAccessibleName("Introduction")
  await expect(groups.nth(1)).toHaveAccessibleName(partOne)
  await expect(groups.nth(2)).toHaveAccessibleName(new RegExp(`^${partTwo}`))
  await expect(groups.nth(3)).toHaveAccessibleName("Appendices")
  await expect(page.locator("[data-section-head]")).toHaveCount(0)

  const file = testInfo.outputPath("first-slide-later.pptx")
  await savedExport(page, file)
  const { readParts, readSections, sectionListFailures } = await import("../../packages/pptx/src/index.ts")
  const parts = await readParts(new Uint8Array(await readFile(file)))
  expect(sectionListFailures(parts)).toEqual([])
  expect(readSections(parts).map((section) => `${section.name} ${String(section.slides.length)}`)).toEqual([
    "Introduction 1",
    `${partOne} 28`,
    `${partTwo} 10`,
    "Appendices 2",
  ])
  const exported = readSections(parts)[1]?.slides ?? []
  expect(exported).toEqual((await saved.rows())[1])
  expect(exported.toSorted()).toEqual(before.toSorted())
})
