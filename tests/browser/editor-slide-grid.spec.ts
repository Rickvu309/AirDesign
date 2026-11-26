import { expect, type Page } from "@playwright/test"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { clickSlide, openEditor, savedSlides } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const entries = (page: Page) => page.locator("[data-slide-entry]")
const entry = (page: Page, number: number) => page.locator(`[data-slide-entry="${String(number)}"]`)
const gridView = (page: Page) => page.getByRole("button", { name: slideListCopy.gridView })
const top = async (page: Page, number: number) => (await entry(page, number).boundingBox())?.y

test("Grid view lays the slides out in lines, keeps the slide list's moves and undo, and a double click opens a slide", async ({
  page,
  context,
  stack,
}) => {
  const faults: string[] = []
  page.on("pageerror", (error) => faults.push(error.message))
  const opened = await openEditor(page, context, stack)
  const saved = () => savedSlides(stack, opened)
  for (const count of [2, 3, 4, 5, 6]) {
    await page.getByRole("button", { name: slideListCopy.addSlide }).click()
    await expect(entries(page)).toHaveCount(count)
  }
  await expect.poll(async () => (await saved()).length).toBe(6)
  const [one, two, three, four, five, six] = await saved()

  await expect(gridView(page)).toHaveAttribute("aria-pressed", "false")
  await gridView(page).focus()
  await page.keyboard.press("Space")
  await expect(gridView(page)).toHaveAttribute("aria-pressed", "true")
  const room = await page.locator("[data-grid-room]").boundingBox()
  const last = await entry(page, 6).boundingBox()
  expect((last?.y ?? 0) + (last?.height ?? 0)).toBeLessThan((room?.y ?? 0) + (room?.height ?? 0))
  await expect(page.getByRole("complementary")).toHaveCount(0)
  await expect(page.locator("[data-slide-grid]")).toBeVisible()
  await expect(page.locator("[data-editor-canvas]")).toHaveCount(0)
  await expect(entry(page, 6)).toHaveAttribute("aria-current", "true")
  expect(await top(page, 1)).toBe(await top(page, 2))
  expect(await top(page, 6)).toBeGreaterThan((await top(page, 1)) ?? 0)

  await expect(entry(page, 6)).toBeFocused()
  await page.keyboard.press("ArrowLeft")
  await expect(entry(page, 5)).toHaveAttribute("aria-current", "true")

  await entry(page, 1).click()
  await page.keyboard.press("ArrowRight")
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("End")
  await expect(entry(page, 6)).toBeFocused()
  await page.keyboard.press("ArrowUp")
  await expect(entry(page, 6)).not.toHaveAttribute("aria-current", "true")
  expect(await top(page, 6)).toBeGreaterThan((await page.locator('[aria-current="true"]').boundingBox())?.y ?? 0)

  await entry(page, 1).dragTo(entry(page, 3))
  await expect.poll(saved).toEqual([two, three, one, four, five, six])
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved).toEqual([one, two, three, four, five, six])

  await entry(page, 2).click()
  await page.keyboard.press("Delete")
  await expect(entries(page)).toHaveCount(5)
  await expect.poll(saved).toEqual([one, three, four, five, six])
  await page.keyboard.press("ControlOrMeta+z")
  await expect(entries(page)).toHaveCount(6)
  await expect.poll(saved).toEqual([one, two, three, four, five, six])

  const design = page.getByRole("button", { name: editorCopy.panelDesign, exact: true })
  await design.click()
  await expect(design).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("[data-slide-grid]")).toBeVisible()
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

  await entry(page, 3).dblclick()
  await expect(gridView(page)).toHaveAttribute("aria-pressed", "false")
  await expect(page.locator("[data-slide-grid]")).toHaveCount(0)
  await expect(page.locator("[data-slide-box]")).toBeVisible()
  await expect(page.locator("[data-slide-label]")).toHaveText("3")
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
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
  await expect(page.locator("[data-slide-grid]")).toBeVisible()
  await expect(entry(page, 1)).toContainText("zebra")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(entry(page, 1)).not.toContainText("zebra")
})
