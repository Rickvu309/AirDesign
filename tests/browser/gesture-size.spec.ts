import { boxCopy } from "../../apps/web/src/copy/box-copy"
import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { boxTurnedExportName, boxTurnedXfrm } from "../../scripts/pptx-cases/box.mjs"
import { designing, unfold, openDeck, storedRows } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { test } from "./deck-test"

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

type Box = { readonly x: number; readonly y: number; readonly cx: number; readonly cy: number }

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary
const slideWidth = 12_192_000

test.use({ viewport: { width: 1470, height: 923 } })

async function slideXml(file: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => item.filename === "ppt/slides/slide1.xml")
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error("slide1.xml")
  return new TextDecoder().decode(bytes)
}

async function lastBox(page: Page): Promise<unknown> {
  const boxes = (await storedRows(page)).filter((row) => row.property === "box")
  return boxes.at(-1)?.value ?? null
}

async function dragGrip(page: Page, grip: Locator, by: { readonly x: number; readonly y: number }): Promise<void> {
  const bounds = await grip.boundingBox()
  if (bounds === null) throw new Error("no grip")
  const from = { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height / 2) }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 })
  await page.mouse.up()
}

async function exported(page: Page, file: string): Promise<string> {
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  await (await saving).saveAs(file)
  return slideXml(file)
}

test("a turned shape resizes by its corner, keeps the opposite corner on screen and exports turned @export", async ({
  page,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", boxTurnedExportName)
  await rm(judged, { force: true })
  await openDeck(page, "clean.pptx")
  const panel = await designing(page, page.locator('[contenteditable="true"]'))
  await unfold(panel, boxCopy.section)
  const rotation = panel.getByRole("textbox", { name: "Rotation", exact: true })
  await rotation.fill("30")
  await rotation.press("Enter")
  const frame = page.locator("[data-slide-paint] [data-selection]")
  await expect(frame).toHaveCSS("transform", /matrix\(0\.866/)
  const grips = frame.locator("[data-grip]")
  await expect(grips).toHaveCount(12)
  const painted = await page.locator("[data-slide-paint]").boundingBox()
  if (painted === null) throw new Error("no slide")
  const twentieth = painted.width / 20
  await dragGrip(page, frame.locator('[data-grip="bottom-right"]'), { x: twentieth, y: -twentieth / 2 })
  await expect.poll(() => lastBox(page)).toEqual({ x: 574_236, y: 589_182, cx: 5_861_929, cy: 1_260_035 })
  await page.reload()
  await decks.ready()
  const file = testInfo.outputPath(boxTurnedExportName)
  const xml = await exported(page, file)
  expect(xml).toContain(boxTurnedXfrm)
  await copyFile(file, judged)
})
