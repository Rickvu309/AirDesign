import { join } from "node:path"
import { type Locator, type Page } from "@playwright/test"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { decksOn, expect, test } from "./deck-test"
import { covers } from "./gesture"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const first = "ppt/slides/slide1.xml"
const second = "ppt/slides/slide2.xml"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

async function opened(page: Page, file: string): Promise<void> {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await decksOn(page).open(join(fixtures, file))
}

function layer(page: Page, part: string, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(shape)}"]`)
}

async function placed(locator: Locator): Promise<number[]> {
  return locator.evaluate((frame: HTMLElement) =>
    [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) => Number.parseFloat(each)),
  )
}

function drawn(locator: Locator): Promise<string> {
  return locator.evaluate((node) => {
    const painted = [node, ...node.querySelectorAll("*")].map((each) => getComputedStyle(each).backgroundImage)
    return painted.find((each) => each.includes("blob:")) ?? ""
  })
}

function chosen(page: Page): Locator {
  return page.locator("[data-slide-paint] [data-selection]")
}

async function slide(page: Page, number: number): Promise<void> {
  await page.locator(`[data-slide-entry="${String(number)}"]`).click()
  await expect(page.locator(`[data-slide-entry="${String(number)}"]`)).toHaveAttribute("aria-current", "true")
}

test("Ctrl+C and Ctrl+V paste a layer over itself and in its place on another slide, Ctrl+Shift+V pastes over the selection, Ctrl+X cuts, each one undo", async ({
  page,
}) => {
  covers("copy", "paste", "paste-over", "cut")
  await opened(page, "sections-before.pptx")
  const rectangle = layer(page, first, 2)
  const at = await placed(rectangle)
  await rectangle.click()
  await page.keyboard.press("ControlOrMeta+KeyC")
  await page.keyboard.press("ControlOrMeta+KeyV")
  await expect(layer(page, first, 3)).toBeVisible()
  expect(await placed(layer(page, first, 3))).toEqual(at)
  await expect(chosen(page)).toHaveAttribute("data-selection", "256.3")
  await expect(layer(page, first, 3)).toBeFocused()
  await page.getByRole("button", { name: undoCopy.undoNamed["paste-layer"], exact: true }).click()
  await expect(layer(page, first, 3)).toHaveCount(0)

  await slide(page, 2)
  await page.locator("[data-slide-paint]").focus()
  await page.keyboard.press("ControlOrMeta+KeyV")
  const pasted = layer(page, second, 9)
  await expect(pasted).toBeVisible()
  expect(await placed(pasted)).toEqual(at)
  await expect(pasted).toBeFocused()

  const text = layer(page, second, 7)
  await text.click()
  await page.keyboard.press("ControlOrMeta+Shift+KeyV")
  const over = layer(page, second, 10)
  await expect(over).toBeVisible()
  const [left, top] = await placed(text)
  expect((await placed(over)).slice(0, 2)).toEqual([left, top])
  await expect(chosen(page)).toHaveAttribute("data-selection", "257.10")

  await page.keyboard.press("ControlOrMeta+KeyX")
  await expect(over).toHaveCount(0)
  await page.getByRole("button", { name: undoCopy.undoNamed["cut-layer"], exact: true }).click()
  await expect(over).toBeVisible()

  await page.locator("[data-design-mode]").click()
  const row = page.locator('[data-layers-panel] [data-layer-row="257.7"]')
  await row.click()
  await row.focus()
  await page.keyboard.press("ControlOrMeta+KeyC")
  await page.keyboard.press("ControlOrMeta+KeyV")
  await expect(layer(page, second, 11)).toBeVisible()
  expect(await placed(layer(page, second, 11))).toEqual(await placed(text))

  await page.reload()
  await decksOn(page).ready()
  await slide(page, 2)
  await expect(layer(page, second, 9)).toBeVisible()
  await expect(layer(page, second, 10)).toBeVisible()
  expect(await placed(layer(page, second, 9))).toEqual(at)
})

test("a layer copied in one tab pastes in another tab of the same deck, and a picture pastes into another deck with its image", async ({
  page,
  context,
}) => {
  covers("copy", "paste")
  await opened(page, "sections-before.pptx")
  const other = await context.newPage()
  await other.goto(page.url())
  await decksOn(other).ready()
  await layer(page, first, 2).click()
  await page.keyboard.press("ControlOrMeta+KeyC")
  await slide(other, 2)
  await other.locator("[data-slide-paint]").focus()
  await other.keyboard.press("ControlOrMeta+KeyV")
  await expect(layer(other, second, 9)).toBeVisible()

  const pictures = await context.newPage()
  await opened(pictures, "picture-png.pptx")
  const picture = layer(pictures, first, 4)
  const size = await placed(picture)
  await picture.click()
  await pictures.keyboard.press("ControlOrMeta+KeyC")
  const elsewhere = await context.newPage()
  await opened(elsewhere, "clean.pptx")
  await elsewhere.locator("[data-slide-paint]").focus()
  await elsewhere.keyboard.press("ControlOrMeta+KeyV")
  const pasted = layer(elsewhere, first, 3)
  await expect(pasted).toBeVisible()
  expect(await placed(pasted)).toEqual(size)
  await expect.poll(() => drawn(pasted)).toContain("blob:")
  await expect(elsewhere.getByRole("button", { name: undoCopy.undoNamed["paste-layer"], exact: true })).toBeVisible()
  await elsewhere.reload()
  await decksOn(elsewhere).ready()
  await expect.poll(() => drawn(layer(elsewhere, first, 3))).toContain("blob:")
})
