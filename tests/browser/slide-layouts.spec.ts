import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { stored } from "./device-store"
import { exportFromDialog } from "./export-dialog.ts"

test.use({ viewport: { width: 1600, height: 1000 } })

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }
type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

async function partText(file: string, name: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => item.filename === name)
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error(name)
  return new TextDecoder().decode(bytes)
}

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function blank(page: Page): Promise<void> {
  await page.goto("/")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByRole("button", { name: "Blank deck", exact: true }).click()
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
}

const layoutNames = ["Title Slide", "Title and Content", "Section Header", "Two Content", "Title Only", "Blank"]
const entry = (page: Page, number: number) => page.locator(`[data-slide-entry="${number}"]`)
const placeholder = (page: Page, part: string, shape: number) =>
  page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(shape)}"]`)

test("a person picks the layout of a new slide, types in its placeholders, and it survives a reload and the export @export", async ({
  page,
}, testInfo) => {
  await blank(page)
  await page.getByRole("button", { name: "Choose a layout for the new slide" }).click()
  const menu = page.getByRole("menu")
  await expect(menu.getByRole("menuitem")).toHaveText(layoutNames)
  await menu.getByRole("menuitem", { name: "Two Content", exact: true }).click()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(3)
  await expect(page.locator("[data-slide-paint] [data-placeholder-prompt]")).toHaveCount(3)
  const heading = placeholder(page, "ppt/slides/slide2.xml", 2).locator('[contenteditable="true"]')
  await heading.click()
  await heading.pressSequentially("Two columns", { delay: 20 })
  await expect(heading).toHaveText("Two columns")
  await stored(page, "Two columns")
  await page.keyboard.press("Escape")
  await page.reload()
  await settled(page)
  await entry(page, 2).click()
  await expect(heading).toHaveText("Two columns")
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(3)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("slide-layouts.pptx")
  await (await saving).saveAs(file)
  const rels = await partText(file, "ppt/slides/_rels/slide2.xml.rels")
  expect(rels).toContain('Target="../slideLayouts/slideLayout4.xml"')
  expect(rels).not.toContain("slideLayout1.xml")
  const added = await partText(file, "ppt/slides/slide2.xml")
  expect(added).toContain("<a:t>Two columns</a:t>")
  expect(added.match(/<p:ph /g)).toHaveLength(3)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await settled(page)
  await entry(page, 2).click()
  await expect(heading).toHaveText("Two columns")
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(3)
})

test("the plus button adds the deck's content layout after a title slide and the same layout after any other", async ({
  page,
}) => {
  await blank(page)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(2)
  await expect(page.locator("[data-slide-paint] [data-placeholder-prompt]")).toHaveCount(2)
  await page.getByRole("button", { name: "Choose a layout for the new slide" }).click()
  await page.getByRole("menuitem", { name: "Title Only", exact: true }).click()
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(1)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(entry(page, 4)).toHaveAttribute("aria-current", "true")
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(1)
})

test("Undo removes a slide added from the menu and Redo brings it back with its layout", async ({ page }) => {
  await blank(page)
  await page.getByRole("button", { name: "Choose a layout for the new slide" }).click()
  await page.getByRole("menuitem", { name: "Two Content", exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await page.getByRole("button", { name: /^Undo/ }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await page.getByRole("button", { name: /^Redo/ }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(page.locator("[data-slide-paint] [data-canvas-element]")).toHaveCount(3)
})
