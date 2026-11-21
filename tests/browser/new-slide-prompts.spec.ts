import { copyFile, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { stored } from "./device-store"
import { exportFromDialog } from "./export-dialog.ts"
import { decksOn, test } from "./deck-test"

test.use({ viewport: { width: 1600, height: 1000 } })

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }
type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

async function slideTexts(file: string): Promise<readonly string[]> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const texts: string[] = []
  for (const entry of await reader.getEntries()) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(entry.filename)) continue
    texts.push(new TextDecoder().decode(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return texts
}

async function imported(page: Page, file: string): Promise<void> {
  await decksOn(page).open(file)
}

const prompts = (page: Page) => page.locator("[data-slide-paint] [data-placeholder-prompt]")
const canvas = (page: Page) => page.locator("[data-slide-paint] [data-canvas-element]")

async function titleAndContent(page: Page): Promise<void> {
  await page.locator('[data-slide-entry="1"]').click()
  await page.getByRole("button", { name: "Choose a layout for the new slide" }).click()
  await page.locator('[data-layout="ppt/slideLayouts/slideLayout2.xml"]').click()
  await expect(page.locator('[data-slide-entry="2"]')).toHaveAttribute("aria-current", "true")
}

test("a new Title and Content slide shows prompts in its text colour, types at the first level, and exports one paragraph @export", async ({
  page,
}, testInfo) => {
  await imported(page, join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx"))
  await titleAndContent(page)
  await expect(canvas(page)).toHaveCount(2)
  await expect(prompts(page)).toHaveText(["Click to add title", "Click to add text"])
  await expect(page.getByText("Click to edit Master")).toHaveCount(0)
  const ink = await prompts(page)
    .nth(1)
    .locator("div")
    .evaluate((element) => getComputedStyle(element).color)
  const body = canvas(page).nth(1).locator('[contenteditable="true"]')
  await body.click()
  await body.pressSequentially("First point", { delay: 20 })
  await expect(body).toHaveText("First point")
  await expect(prompts(page)).toHaveText(["Click to add title"])
  expect(
    await body.getByText("First point", { exact: true }).evaluate((element) => getComputedStyle(element).color),
  ).toBe(ink)
  await stored(page, "First point")
  await page.keyboard.press("Escape")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("new-slide-prompts.pptx")
  await (await saving).saveAs(file)
  await copyFile(file, join(process.cwd(), "tests/browser/exported-new-slide-prompts.pptx"))
  const added = (await slideTexts(file)).filter((xml) => xml.includes("First point"))
  expect(added).toHaveLength(1)
  const xml = added[0] ?? ""
  expect(xml).not.toContain("Click to")
  expect(xml).not.toMatch(/lvl="[1-8]"/)
  expect(xml).not.toMatch(/type="(dt|ftr|sldNum)"/)
  const typed = xml.slice(xml.lastIndexOf("<p:txBody>", xml.indexOf("First point")))
  expect(typed.slice(0, typed.indexOf("</p:txBody>")).match(/<a:p[ >]/g)).toHaveLength(1)
  await imported(page, file)
  await page.locator('[data-slide-entry="2"]').click()
  await expect(canvas(page).nth(1)).toContainText("First point")
  await expect(prompts(page)).toHaveText(["Click to add title"])
})

test("a new slide carries the footer boxes the deck's slide master shows", async ({ page }) => {
  await imported(page, join(process.cwd(), "scripts/pptx-fixtures/corpus/nasa-cots-parts-nesc.pptx"))
  await titleAndContent(page)
  const slide = page.locator("[data-slide-paint]")
  await expect(slide).toContainText("Microelectronics Reliability and Qualification Workshop 2022")
  await expect(slide).toContainText("2/9/2022")
  await expect(prompts(page).first()).toHaveText("Click to add title")
  await expect(prompts(page).nth(1)).toHaveText("Click to add text")
  await expect(slide).not.toContainText("‹#›")
})
