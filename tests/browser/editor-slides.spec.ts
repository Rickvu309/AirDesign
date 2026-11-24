import { expect, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, openEditor, savedNode, savedSlides, selectedIds, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const entries = (page: Page) => page.locator("[data-slide-entry]")
const entry = (page: Page, number: number) => page.locator(`[data-slide-entry="${String(number)}"]`)
const painted = (page: Page) => page.locator("[data-slide-box] [data-node]")
const currentNumber = (page: Page) =>
  page.locator('[data-slide-entry][aria-current="true"]').getAttribute("data-slide-entry")

test("the slide strip shows, adds, steps through, reorders, deletes and restores slides, and a reload keeps them", async ({
  page,
  context,
  stack,
}) => {
  covers("slide-add", "slide-duplicate", "slide-delete", "slide-up", "slide-previous", "slide-next", "undo")
  const faults: string[] = []
  page.on("pageerror", (error) => faults.push(error.message))
  const opened: Opened = await openEditor(page, context, stack)
  const saved = () => savedSlides(stack, opened)
  const [first] = await saved()
  await expect(entries(page)).toHaveCount(1)
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await expect(painted(page)).toHaveCount(2)

  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect(entries(page)).toHaveCount(2)
  expect(await currentNumber(page)).toBe("2")
  await expect(painted(page)).toHaveCount(1)
  await expect.poll(async () => (await saved()).length).toBe(2)
  const [, added] = await saved()
  expect(await savedNode(stack, opened, added ?? "")).toMatchObject({ type: "slide", name: "Slide 2" })

  await entry(page, 1).click()
  expect(await currentNumber(page)).toBe("1")
  await expect(painted(page)).toHaveCount(2)

  await page.keyboard.press("Enter")
  await expect(entries(page)).toHaveCount(3)
  expect(await currentNumber(page)).toBe("2")
  await expect(painted(page)).toHaveCount(1)
  await expect.poll(async () => (await saved()).length).toBe(3)
  const order = await saved()
  expect(order[0]).toBe(first)
  expect(order[2]).toBe(added)

  await page.keyboard.press("ArrowUp")
  expect(await currentNumber(page)).toBe("1")
  await expect(painted(page)).toHaveCount(2)
  await clickSlide(page, 100, 100)
  expect(await selectedIds(page)).toEqual([])
  await page.keyboard.press("ArrowDown")
  expect(await currentNumber(page)).toBe("2")
  await page.keyboard.press("PageDown")
  expect(await currentNumber(page)).toBe("3")
  await page.keyboard.press("PageUp")
  expect(await currentNumber(page)).toBe("2")

  await entry(page, 3).dragTo(entry(page, 1))
  await expect.poll(saved).toEqual([added, first, order[1]])
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")

  await entry(page, 2).click()
  await expect(painted(page)).toHaveCount(2)
  await page.keyboard.press("ControlOrMeta+BracketRight")
  await expect.poll(saved).toEqual([added, order[1], first])
  await page.keyboard.press("ControlOrMeta+d")
  await expect(entries(page)).toHaveCount(4)
  await expect.poll(async () => (await saved()).length).toBe(4)
  await expect(painted(page)).toHaveCount(2)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(entries(page)).toHaveCount(3)

  await entry(page, 3).click()
  await expect(painted(page)).toHaveCount(2)
  await page.keyboard.press("Delete")
  await expect(entries(page)).toHaveCount(2)
  await expect.poll(async () => (await savedNode(stack, opened, first ?? ""))?.parent).toBeNull()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(entries(page)).toHaveCount(3)
  await entry(page, 3).click()
  await expect(painted(page)).toHaveCount(2)

  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await expect(entries(page)).toHaveCount(3)
  await expect.poll(saved).toEqual([added, order[1], first])
  await entry(page, 3).click()
  await expect(painted(page)).toHaveCount(2)

  await clickSlide(page, 600, 420)
  expect(await selectedIds(page)).not.toEqual([])
  await page.keyboard.press("Delete")
  await expect(painted(page)).toHaveCount(1)
  await expect(entries(page)).toHaveCount(3)
  expect(faults).toEqual([])
})

test("the last slide cannot be deleted", async ({ page, context, stack }) => {
  covers("slide-delete")
  const opened = await openEditor(page, context, stack)
  await entry(page, 1).click()
  await page.keyboard.press("Delete")
  await expect(entries(page)).toHaveCount(1)
  expect(await savedSlides(stack, opened)).toHaveLength(1)
})
