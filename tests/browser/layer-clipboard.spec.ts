import { writeFile } from "node:fs/promises"
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
  covers("copy", "paste", "paste-over", "cut", "paste-replace")
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

  const replaced = layer(page, second, 5)
  const [x, y] = await placed(replaced)
  await replaced.click()
  await page.keyboard.press("ControlOrMeta+Shift+KeyR")
  await expect(replaced).toHaveCount(0)
  const replacing = layer(page, second, 11)
  await expect(replacing).toBeVisible()
  expect((await placed(replacing)).slice(0, 2)).toEqual([x, y])
  await expect(chosen(page)).toHaveAttribute("data-selection", "257.11")
  await page.getByRole("button", { name: undoCopy.undoNamed["replace-layer"], exact: true }).click()
  await expect(replacing).toHaveCount(0)
  await expect(replaced).toBeVisible()

  await page.locator("[data-design-mode]").click()
  const row = page.locator('[data-layers-panel] [data-layer-row="257.7"]')
  await row.click()
  await row.focus()
  await page.keyboard.press("ControlOrMeta+KeyC")
  await page.keyboard.press("ControlOrMeta+KeyV")
  await expect(layer(page, second, 12)).toBeVisible()
  expect(await placed(layer(page, second, 12))).toEqual(await placed(text))

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

async function clippedPicture(page: Page) {
  return page.evaluate(async () => {
    const items = await navigator.clipboard.read()
    const item = items.find((each) => each.types.includes("image/png"))
    if (item === undefined) return null
    const bitmap = await createImageBitmap(await item.getType("image/png"))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext("2d")
    if (context === null) return null
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    let dark = 0
    for (let at = 0; at < data.length; at += 4) if (data[at]! < 80 && data[at + 3]! > 200) dark += 1
    const middle = (Math.floor(bitmap.height * 0.8) * bitmap.width + Math.floor(bitmap.width / 2)) * 4
    const png = await (await item.getType("image/png")).arrayBuffer()
    let binary = ""
    for (const byte of new Uint8Array(png)) binary += String.fromCharCode(byte)
    return {
      width: bitmap.width,
      height: bitmap.height,
      dark,
      middle: [...data.slice(middle, middle + 4)],
      png: btoa(binary),
    }
  })
}

test("Ctrl+Shift+C copies the selected layer as a PNG at twice its size, its fill and its text", async ({ page }) => {
  covers("copy-png")
  await opened(page, "clean.pptx")
  await layer(page, first, 2).click()
  await page.keyboard.press("ControlOrMeta+Shift+KeyC")
  await expect.poll(() => clippedPicture(page), { timeout: 10_000 }).not.toBeNull()
  const shown = await clippedPicture(page)
  await writeFile(test.info().outputPath("copied.png"), Buffer.from(shown?.png ?? "", "base64"))
  expect(shown).toMatchObject({ width: 1152, height: 384 })
  expect(shown?.dark).toBeGreaterThan(100)
  expect(shown?.middle).toEqual([187, 224, 227, 255])
})
