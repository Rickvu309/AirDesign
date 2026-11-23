import { expect, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { accent, clickSlide, landNodes, openDoomEditor, savedNode, savedSlides, selectedIds, spot } from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const entry = (page: Page, number: number) => page.locator(`[data-slide-entry="${String(number)}"]`)
const entries = (page: Page) => page.locator("[data-slide-entry]")
const menu = (page: Page) => page.locator('[role="menu"][data-open]')

async function withThreeSlides(
  page: Page,
  context: Parameters<typeof openDoomEditor>[1],
  stack: Parameters<typeof openDoomEditor>[2],
) {
  const opened = await openDoomEditor(page, context, stack)
  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect(entries(page)).toHaveCount(3)
  await expect.poll(async () => (await savedSlides(stack, opened)).length).toBe(3)
  return { opened, order: await savedSlides(stack, opened) }
}

test("Alt+Down and Mod+] move the chosen slide one place later, and a reload keeps the order", async ({
  page,
  context,
  stack,
}) => {
  covers("slide-down", "undo")
  const { opened, order } = await withThreeSlides(page, context, stack)
  const [first, second, third] = order

  await entry(page, 1).click()
  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(() => savedSlides(stack, opened)).toEqual([second, first, third])
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")

  await page.keyboard.press("ControlOrMeta+BracketRight")
  await expect.poll(() => savedSlides(stack, opened)).toEqual([second, third, first])
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")

  await page.keyboard.press("Alt+ArrowDown")
  expect(await savedSlides(stack, opened)).toEqual([second, third, first])

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => savedSlides(stack, opened)).toEqual([second, first, third])

  await page.reload()
  await page.locator("[data-doom-ready]").waitFor()
  await expect(entries(page)).toHaveCount(3)
  expect(await savedSlides(stack, opened)).toEqual([second, first, third])
})

test("the Menu key and Shift+F10 open the slide menu on the focused slide, which moves it and closes on Escape", async ({
  page,
  context,
  stack,
}) => {
  covers("slide-menu")
  const { opened, order } = await withThreeSlides(page, context, stack)
  const [first, second, third] = order

  await entry(page, 1).focus()
  await page.keyboard.press("ContextMenu")
  await expect(menu(page)).toHaveCount(1)
  await expect(menu(page)).toContainText(/Duplicate/)
  await page.keyboard.press("Escape")
  await expect(menu(page)).toHaveCount(0)

  await entry(page, 1).focus()
  await page.keyboard.press("Shift+F10")
  await expect(menu(page)).toHaveCount(1)
  await menu(page)
    .getByRole("menuitem", { name: /Move down/ })
    .click()
  await expect(menu(page)).toHaveCount(0)
  await expect.poll(() => savedSlides(stack, opened)).toEqual([second, first, third])

  await entry(page, 3).focus()
  await page.keyboard.press("ContextMenu")
  await menu(page)
    .getByRole("menuitem", { name: /Delete/ })
    .click()
  await expect.poll(() => savedSlides(stack, opened)).toEqual([second, first])
})

test("Shift+V flips the selected layer top to bottom, again flips it back, undo restores it, and a reload keeps it", async ({
  page,
  context,
  stack,
}) => {
  covers("flip-vertical", "undo")
  const opened = await openDoomEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(200, 600, 300, 150), fills: accent } },
    { id: "t:2", type: "shape", parent: opened.slide, props: { box: spot(700, 600, 300, 150), fills: accent } },
  ])
  const boxOf = async (id: string) => (await savedNode(stack, opened, id))?.box as Record<string, unknown>
  const painted = (id: string) => page.locator(`[data-slide-box] [data-node="${id}"] > div`).first()

  await page.keyboard.press("Shift+V")
  expect((await boxOf("t:1")).flipV).toBe(false)

  await clickSlide(page, 350, 675)
  expect(await selectedIds(page)).toEqual(["t:1"])
  await page.keyboard.press("Shift+V")
  await expect.poll(async () => (await boxOf("t:1")).flipV).toBe(true)
  expect(await boxOf("t:1")).toMatchObject({ x: 200, y: 600, w: 300, h: 150, flipH: false, rotation: 0 })
  expect((await boxOf("t:2")).flipV).toBe(false)
  await expect(painted("t:1")).toHaveCSS("transform", /matrix\(1, 0, 0, -1/)
  await expect(painted("t:2")).toHaveCSS("transform", "none")

  await page.keyboard.press("Shift+V")
  await expect.poll(async () => (await boxOf("t:1")).flipV).toBe(false)
  await expect(painted("t:1")).toHaveCSS("transform", "none")
  await page.keyboard.press("Shift+V")
  await expect.poll(async () => (await boxOf("t:1")).flipV).toBe(true)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await boxOf("t:1")).flipV).toBe(false)
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(async () => (await boxOf("t:1")).flipV).toBe(true)

  await page.reload()
  await page.locator("[data-doom-ready]").waitFor()
  await expect(painted("t:1")).toHaveCSS("transform", /matrix\(1, 0, 0, -1/)
})
