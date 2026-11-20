import { copyFile, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { Page } from "@playwright/test"
import { groupCopy } from "../../apps/web/src/copy/arrange-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { expect, test } from "./deck-test"
import { fixtures } from "./design-panel"
import { savedExport } from "./export-dialog"
import { covers } from "./gesture"

const slidePart = "ppt/slides/slide1.xml"
const picture = `[data-slide-paint] [data-canvas-element="${slidePart}#4"]`

test.use({ viewport: { width: 1600, height: 1000 } })

async function exportedSlide(file: string): Promise<{ xml: string; media: readonly Uint8Array[] }> {
  const { readParts } = await import("../../packages/pptx/dist/index.js")
  const parts = await readParts(await readFile(file))
  const xml = new TextDecoder().decode(parts.get(slidePart))
  const media = [...parts].filter(([name]) => name.startsWith("ppt/media/")).map(([, bytes]) => bytes)
  return { xml, media }
}

async function onPicture(page: Page, name: string) {
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name, exact: true }).click()
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  const added = page.locator("[data-slide-paint] [data-selection]")
  await expect(added).toHaveCount(1)
  const from = await added.boundingBox()
  const to = await page.locator(picture).boundingBox()
  if (from === null || to === null) throw new Error("no box")
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
  await page.mouse.up()
}

async function circleBehindPicture(page: Page) {
  await onPicture(page, shapeCopy.shapes.circle)
  await page.keyboard.press("BracketLeft")
  await page.locator(picture).click({ modifiers: [shortcutCopy.chord.other.shift], position: { x: 8, y: 8 } })
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(2)
}

test("Use as mask clips a picture to a circle, undoes in one step, and exports the picture with the circle's outline @export", async ({
  page,
  decks,
}, testInfo) => {
  covers("mask")
  await decks.open(join(fixtures, "picture-png.pptx"))
  await circleBehindPicture(page)
  await page.keyboard.press("Control+Alt+KeyM")
  const clip = page.locator("[data-slide-paint] [data-mask-clip]")
  await expect(clip).toHaveCount(1)
  await expect(clip.locator(`[data-canvas-element="${slidePart}#4"]`)).toHaveCount(1)
  await page.getByRole("button", { name: undoCopy.undoNamed.mask, exact: true }).click()
  await expect(clip).toHaveCount(0)
  await page.getByRole("button", { name: undoCopy.redoNamed.mask, exact: true }).click()
  await expect(clip).toHaveCount(1)
  const inside = await page.locator(picture).boundingBox()
  if (inside === null) throw new Error("no picture")
  await page.mouse.dblclick(inside.x + inside.width / 2, inside.y + inside.height / 2)
  const chosen = page.locator("[data-slide-paint] [data-selection]")
  await expect(chosen).toHaveAttribute("data-selection", /\.4$/)
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await page.locator(picture).boundingBox())?.x).toBeGreaterThan(inside.x)
  await expect(clip.locator(`[data-canvas-element="${slidePart}#4"]`)).toHaveCount(1)
  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  await expect(layers.getByText("Mask group", { exact: true })).toBeVisible()
  await expect(layers.locator("[data-layer-masked]")).toHaveCount(1)
  await expect(layers.locator("[data-layer-mask]")).toHaveCount(1)
  const exported = testInfo.outputPath("exported-mask.pptx")
  await savedExport(page, exported)
  await copyFile(exported, join(process.cwd(), "tests/browser/exported-mask.pptx"))
  const { xml } = await exportedSlide(exported)
  expect(xml.match(/hidden="1"/g)).toHaveLength(2)
  expect(xml).toMatch(
    /<p:pic><p:nvPicPr><p:cNvPr id="\d+" name="Picture 4"\/>.*?<a:srcRect[^>]*\/>.*?<a:prstGeom prst="ellipse">/,
  )
  await decks.open(exported)
  await expect(page.locator("[data-slide-paint] [data-mask-clip]")).toHaveCount(1)
})

test("a mask over a picture and a shape exports a picture of how it looks, and imports back as the mask", async ({
  page,
  decks,
}, testInfo) => {
  await decks.open(join(fixtures, "picture-png.pptx"))
  await onPicture(page, shapeCopy.shapes.square)
  await circleBehindPicture(page)
  await page
    .locator(`[data-slide-paint] [data-canvas-element="${slidePart}#5"]`)
    .click({ modifiers: [shortcutCopy.chord.other.shift] })
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(3)
  const box = await page.locator(picture).boundingBox()
  if (box === null) throw new Error("no picture")
  await page.mouse.click(box.x + 10, box.y + 10, { button: "right" })
  await page.getByRole("menuitem", { name: new RegExp(`^${groupCopy.label.mask}`) }).click()
  await expect(page.locator("[data-slide-paint] [data-mask-clip]")).toHaveCount(1)
  const exported = testInfo.outputPath("exported-mask-picture.pptx")
  await savedExport(page, exported)
  const { xml, media } = await exportedSlide(exported)
  const opening = await exportedSlide(join(process.cwd(), "scripts/pptx-fixtures/picture-png.pptx"))
  expect(xml.match(/hidden="1"/g)).toHaveLength(3)
  const look = media.find((bytes) => !opening.media.some((kept) => Buffer.from(kept).equals(Buffer.from(bytes))))
  if (look === undefined) throw new Error("no picture of the look")
  const pixels = await page.evaluate(
    async (bytes) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/png" }))
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext("2d")!
      context.drawImage(bitmap, 0, 0)
      const at = (x: number, y: number) => context.getImageData(x, y, 1, 1).data[3]
      return { corner: at(1, 1), center: at(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2)) }
    },
    [...look],
  )
  expect(pixels).toEqual({ corner: 0, center: 255 })
  await decks.open(exported)
  await expect(page.locator("[data-slide-paint] [data-mask-clip]")).toHaveCount(1)
})

test("an imported picture cropped to a circle keeps its bytes when a mask beside it exports @export", async ({
  page,
  decks,
}, testInfo) => {
  const opening = await exportedSlide(join(process.cwd(), "scripts/pptx-fixtures/picture-shape-cropped.pptx"))
  const headshot = /<p:pic><p:nvPicPr><p:cNvPr id="4" name="Headshot 4"\/>.*?<\/p:pic>/.exec(opening.xml)?.[0]
  if (headshot === undefined) throw new Error("no headshot")
  await decks.open(join(fixtures, "picture-shape-cropped.pptx"))
  await expect(page.locator("[data-slide-paint] [data-mask-clip]")).toHaveCount(0)
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.square, exact: true }).click()
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  const square = page.locator("[data-slide-paint] [data-selection]")
  const id = await square.getAttribute("data-selection")
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.circle, exact: true }).click()
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  await page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#${id?.split(".")[1] ?? ""}"]`).click({
    modifiers: [shortcutCopy.chord.other.shift],
  })
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(2)
  await page.keyboard.press("Control+Alt+KeyM")
  await expect(page.locator("[data-slide-paint] [data-mask-clip]")).toHaveCount(1)
  const exported = testInfo.outputPath("exported-mask-cropped.pptx")
  await savedExport(page, exported)
  await copyFile(exported, join(process.cwd(), "tests/browser/exported-mask-cropped.pptx"))
  expect((await exportedSlide(exported)).xml).toContain(headshot)
})
