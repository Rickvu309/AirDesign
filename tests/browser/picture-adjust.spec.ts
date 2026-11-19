import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { colorWords } from "./color-words"
import { openDeck, setPanelMode, settled } from "./design-panel"
import { savedExport } from "./export-dialog"
import { boxFillPanel, partsOf } from "./shape-fills"

const part = "ppt/slides/slide1.xml"
const pictureKey = `${part}#4`
const media = "ppt/media/picture-008753c5d40023df.png"

function picture(page: Page): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${pictureKey}"]`)
}

async function designed(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await picture(page).click({ position: { x: 8, y: 8 } })
  const panel = page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  await setPanelMode(page, "slides")
  return panel
}

function blurred(painted: Locator): Promise<boolean> {
  return painted.evaluate((node) =>
    [node, ...node.querySelectorAll("*")].some((each) => getComputedStyle(each).filter.includes("blur")),
  )
}

function overlaid(painted: Locator): Promise<boolean> {
  return painted.evaluate((node) =>
    [node, ...node.querySelectorAll("*")].some((each) =>
      /linear-gradient\((rgba?\([^)]*\)), \1\)/.test(getComputedStyle(each).backgroundImage),
    ),
  )
}

test("a person lays a colour over a picture and blurs it @export", async ({ page }) => {
  test.setTimeout(90_000)
  const { picturePanelCopy: pictureCopy } = await import("../../apps/web/src/copy/picture-panel-copy")
  const names = await colorWords("picture-png.pptx")
  await openDeck(page, "picture-png.pptx")
  const panel = await designed(page)
  const kinds = panel.getByRole("group", { name: fillCopy.value, exact: true })
  await expect(kinds).toBeVisible()
  await expect(kinds.getByRole("button", { name: fillWords.image, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  for (const name of [fillWords.none, fillWords.solid, fillWords.gradient] as const) {
    const choice = kinds.getByRole("button", { name, exact: true })
    await expect(choice).toBeEnabled()
    await expect(choice).toHaveAttribute("title", name)
  }
  await expect(panel.locator("[data-picture-preview]")).toBeVisible()
  await expect(panel.getByRole("button", { name: pictureCopy.overlay, exact: true })).toContainText(pictureCopy.overlay)
  await expect(panel.getByRole("button", { name: pictureCopy.blur, exact: true })).toContainText(pictureCopy.blur)

  await panel.getByRole("button", { name: pictureCopy.overlay, exact: true }).click()
  const overlay = page.locator("[data-overlay-panel]")
  await overlay.getByRole("button", { name: names.dk1, exact: true }).click()
  await page.keyboard.press("Escape")
  await expect.poll(() => overlaid(picture(page))).toBe(true)

  await panel.getByRole("button", { name: pictureCopy.blur, exact: true }).click()
  const blur = page.locator("[data-blur-panel]")
  const amount = blur.getByRole("textbox", { name: pictureCopy.blur, exact: true })
  await amount.fill("40")
  await amount.press("Enter")
  await page.keyboard.press("Escape")
  const wash = picture(page).locator("[data-fill-image]")
  await expect(wash).toBeVisible()
  await expect.poll(() => wash.evaluate((node) => getComputedStyle(node).filter)).toContain("blur")
  await expect(page.locator(`[data-thumb-element="${pictureKey}"] [data-fill-image]`).first()).toBeVisible()

  await page.getByRole("button", { name: presentCopy.present, exact: true }).click()
  const shown = page.locator("[data-present-show]")
  await expect.poll(() => overlaid(shown)).toBe(true)
  await expect(shown.locator("[data-fill-image]")).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: undoCopy.undoNamed.picture, exact: true }).click()
  await expect.poll(() => blurred(picture(page))).toBe(false)
  await expect.poll(() => overlaid(picture(page))).toBe(true)
  await page.getByRole("button", { name: undoCopy.undoNamed.fill, exact: true }).click()
  await expect(picture(page).locator("[data-fill-image]")).toHaveCount(0)
  await expect.poll(() => overlaid(picture(page))).toBe(false)
  await page.getByRole("button", { name: undoCopy.redoNamed.fill, exact: true }).click()
  await page.getByRole("button", { name: undoCopy.redoNamed.picture, exact: true }).click()
  await expect.poll(() => overlaid(picture(page))).toBe(true)
  await expect.poll(() => blurred(picture(page))).toBe(true)

  await page.reload()
  await settled(page)
  await expect.poll(() => overlaid(picture(page))).toBe(true)
  await expect.poll(() => blurred(picture(page))).toBe(true)

  const file = join(process.cwd(), "tests/browser", "exported-picture-adjust.pptx")
  await savedExport(page, file)
  const parts = await partsOf(file)
  const xml = parts.get(part)?.toString() ?? ""
  expect(xml).not.toContain("<a:blur")
  expect(xml).not.toContain("<a:fillOverlay")
  expect(xml).toContain('cx="4572000"')
  expect(xml).toContain('cy="3048000"')
  const added = [...parts.keys()].filter((name) => name.startsWith("ppt/media/picture-") && name !== media)
  expect(added).toHaveLength(1)
  const fixture = await partsOf(join(process.cwd(), "scripts/pptx-fixtures", "picture-png.pptx"))
  const baked = parts.get(media) ?? Buffer.from([])
  expect(Buffer.compare(baked, fixture.get(media) ?? Buffer.from([]))).toBe(0)
})

test("a shape whose fill is an icon shows the picture fill controls", async ({ page }) => {
  const { picturePanelCopy: pictureCopy } = await import("../../apps/web/src/copy/picture-panel-copy")
  const names = await colorWords("clean.pptx")
  await openDeck(page, "clean.pptx")
  const shape = page.locator(`[data-slide-paint] [data-canvas-element="${part}#2"]`)
  const fill = await boxFillPanel(page, shape)
  await fill
    .getByRole("group", { name: fillCopy.box, exact: true })
    .getByRole("button", { name: fillWords.image, exact: true })
    .click()
  await expect(fill.locator("[data-picture-preview]")).toBeVisible()
  await expect(fill.getByRole("combobox", { name: pictureCopy.mode, exact: true })).toBeVisible()
  await expect(fill.getByRole("button", { name: pictureCopy.overlay, exact: true })).toBeVisible()
  await expect(fill.getByRole("button", { name: pictureCopy.blur, exact: true })).toBeVisible()
  await fill.getByRole("button", { name: pictureCopy.overlay, exact: true }).click()
  await page.locator("[data-overlay-panel]").getByRole("button", { name: names.dk1, exact: true }).click()
  await page.keyboard.press("Escape")
  await expect.poll(() => overlaid(shape)).toBe(true)
})
