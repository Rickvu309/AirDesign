import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"
import { exportFromDialog } from "./export-dialog.ts"
import { test } from "./deck-test"

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

async function slideXml(file: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => item.filename === "ppt/slides/slide1.xml")
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error("slide1.xml")
  return new TextDecoder().decode(bytes)
}

async function frameOf(text: Locator) {
  return text.evaluate((node) => {
    const box = node.closest("[data-canvas-element]")?.getBoundingClientRect()
    return box === undefined ? [] : [box.x, box.y, box.width, box.height].map((side) => Math.round(side))
  })
}

async function slideBox(page: Page) {
  const box = await page.locator("[data-slide-paint]").first().boundingBox()
  if (box === null) throw new Error("slide")
  return box
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("T then a click places auto width text at the click, T then a drag draws a fixed size box, and the tool goes back to Move @export", async ({
  page,
  decks,
}, testInfo) => {
  await decks.blank()
  const slide = await slideBox(page)
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  const tool = page.getByRole("button", { name: "Add text", exact: true })
  await page
    .locator("[data-slide-paint]")
    .first()
    .click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("t")
  await expect(tool).toHaveAttribute("aria-pressed", "true")
  await page.mouse.click(slide.x + 160, slide.y + 120)
  await expect(tool).toHaveAttribute("aria-pressed", "false")
  await expect(page.locator("[data-text-placing]")).toHaveCount(0)
  await expect(texts.last()).toBeFocused()
  await page.keyboard.type("Clicked title", { delay: 20 })
  const clicked = await frameOf(texts.last())
  expect(clicked.slice(0, 2)).toEqual([Math.round(slide.x + 160), Math.round(slide.y + 120)])
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")

  await page.keyboard.press("t")
  await page.mouse.move(slide.x + 160, slide.y + 300)
  await page.mouse.down()
  await page.mouse.move(slide.x + 300, slide.y + 330, { steps: 4 })
  await page.mouse.move(slide.x + 460, slide.y + 360, { steps: 4 })
  await page.mouse.up()
  await expect(texts.last()).toBeFocused()
  await page.keyboard.type("A drawn box keeps its width and wraps a long line inside it", { delay: 10 })
  const drawn = await frameOf(texts.last())
  expect(drawn).toEqual([Math.round(slide.x + 160), Math.round(slide.y + 300), 300, 60])
  const lines = await texts.last().evaluate((node) => {
    const range = document.createRange()
    range.selectNodeContents(node)
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
  })
  expect(lines).toBeGreaterThan(1)
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")

  await page.keyboard.press("t")
  await expect(tool).toHaveAttribute("aria-pressed", "true")
  await page.keyboard.press("Escape")
  await expect(tool).toHaveAttribute("aria-pressed", "false")

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("text-tool.pptx")
  await (await saving).saveAs(file)
  const xml = await slideXml(file)
  expect(xml).toContain('<a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0" wrap="none"><a:spAutoFit/></a:bodyPr>')
  expect(xml).toContain('<a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>')
})

test("resizing auto width text by hand makes it fixed size in one undo step", async ({ page, decks }) => {
  await decks.blank()
  const slide = await slideBox(page)
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await page
    .locator("[data-slide-paint]")
    .first()
    .click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("t")
  await page.mouse.click(slide.x + 160, slide.y + 120)
  await page.keyboard.type("A title that will wrap", { delay: 10 })
  await page.keyboard.press("Escape")
  const hugged = await frameOf(texts.last())
  const corner = await page.locator("[data-selection] [data-grip='bottom-right']").boundingBox()
  if (corner === null) throw new Error("corner")
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2)
  await page.mouse.down()
  await page.mouse.move(corner.x - 60, corner.y + 60, { steps: 6 })
  await page.mouse.up()
  await expect.poll(async () => (await frameOf(texts.last()))[2]).toBeLessThan((hugged[2] ?? 0) - 40)
  const fixed = await frameOf(texts.last())
  expect(fixed[3]).toBeGreaterThan((hugged[3] ?? 0) + 40)
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true })).toBeEnabled()
  expect(await frameOf(texts.last())).toEqual(fixed)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => frameOf(texts.last())).toEqual(hugged)
})
