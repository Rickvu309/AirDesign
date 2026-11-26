import { expect, type Page } from "@playwright/test"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { clickSlide, openEditor } from "./editor-deck"
import { covers } from "./gesture"
import { inside, viewport } from "./grid-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const entries = (page: Page) => page.locator("[data-slide-entry]")
const entry = (page: Page, number: number) => page.locator(`[data-slide-entry="${String(number)}"]`)
const gridView = (page: Page) => page.getByRole("button", { name: slideListCopy.gridView })

test("Grid view shows every slide, the island and the tools lead back to Slides view, and Enter or a double click opens a slide", async ({
  page,
  context,
  stack,
}) => {
  covers("slide-open")
  const faults: string[] = []
  page.on("pageerror", (error) => faults.push(error.message))
  await openEditor(page, context, stack)
  for (const count of [2, 3, 4, 5, 6]) {
    await page.getByRole("button", { name: slideListCopy.addSlide }).click()
    await expect(entries(page)).toHaveCount(count)
  }

  await expect(gridView(page)).toHaveAttribute("aria-pressed", "false")
  await gridView(page).focus()
  await page.keyboard.press("Space")
  await expect(gridView(page)).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("button", { name: slideListCopy.slidesView })).toHaveAttribute("aria-pressed", "false")
  await expect(page.getByRole("complementary")).toHaveCount(0)
  await expect(page.locator("[data-editor-canvas]")).toHaveCount(0)
  await expect(page.locator("[data-grid-selected]")).toHaveCount(0)
  for (let number = 1; number <= 6; number += 1) expect(await inside(entry(page, number), viewport(page))).toBe(true)
  await expect(entry(page, 6)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 6)).toBeFocused()
  await page.keyboard.press("ArrowLeft")
  await expect(entry(page, 5)).toHaveAttribute("aria-current", "true")

  const design = page.getByRole("button", { name: editorCopy.panelDesign, exact: true })
  await design.click()
  await expect(design).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
  await expect(page.getByRole("button", { name: presentCopy.present, exact: true })).toHaveCount(1)
  await design.click()
  await expect(page.getByRole("button", { name: presentCopy.present, exact: true })).toHaveCount(1)

  await page.getByRole("button", { name: slideListCopy.slidesView }).click()
  await expect(page.locator("[data-slide-box]")).toBeVisible()
  await gridView(page).click()

  const tools = page.getByRole("toolbar", { name: editorCopy.tools })
  await expect(tools.getByRole("button", { name: editorCopy.toolMove, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await tools.getByRole("button", { name: editorCopy.textTool, exact: true }).click()
  await expect(page.locator("[data-slide-box]")).toBeVisible()
  await expect(tools.getByRole("button", { name: editorCopy.textTool, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await page.keyboard.press("Escape")
  await gridView(page).click()
  await tools.getByRole("button", { name: editorCopy.actions, exact: true }).click()
  await expect(page.locator("[data-slide-box]")).toBeVisible()
  await expect(tools.getByRole("button", { name: editorCopy.actions, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await page.keyboard.press("Escape")
  await gridView(page).click()

  await entry(page, 3).focus()
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-editor-grid]")).toHaveCount(0)
  await expect(page.locator("[data-slide-label]")).toHaveText("3")
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await gridView(page).click()
  await entry(page, 4).dblclick()
  await expect(gridView(page)).toHaveAttribute("aria-pressed", "false")
  await expect(page.locator("[data-editor-grid]")).toHaveCount(0)
  await expect(page.locator("[data-slide-box]")).toBeVisible()
  await expect(page.locator("[data-slide-label]")).toHaveText("4")
  await expect(entry(page, 4)).toHaveAttribute("aria-current", "true")
  expect(faults).toEqual([])
})

test("text typed just before Grid view opens is saved, and an undo there takes it off the slide's picture", async ({
  page,
  context,
  stack,
}) => {
  await openEditor(page, context, stack)
  await clickSlide(page, 960, 490, { double: true })
  await page.keyboard.type(" zebra")
  await expect(entry(page, 1)).toContainText("zebra")
  await gridView(page).click()
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
  await expect(entry(page, 1)).toContainText("zebra")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(entry(page, 1)).not.toContainText("zebra")
})
