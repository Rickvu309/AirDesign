import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { cleanFixture, forward, openClean, settled, signInBrowser, test } from "./api-stack"
import { exportFromDialog } from "./export-dialog"
import { undoCopy } from "../../apps/web/src/copy/undo-copy.ts"

type ZipEntry = {
  readonly filename: string
  readonly directory: boolean
  getData(writer: unknown): Promise<Uint8Array>
}

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

async function partsOf(file: string): Promise<Map<string, Buffer>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Buffer>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return parts
}

test.use({ viewport: { width: 1470, height: 923 } })

test("an export after every edit is undone changes no part of the original", async ({
  page,
  context,
  stack,
}, testInfo) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await openClean(page)
  const text = page.locator('[data-slide-paint] [contenteditable="true"]').first()

  await text.click()
  await page.keyboard.press("ControlOrMeta+a")
  await text.pressSequentially("Changed", { delay: 40 })
  await page.keyboard.press("Escape")
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("slide")
  await page.mouse.move(slide.x + 300, slide.y + 150)
  await page.mouse.down()
  await page.mouse.move(slide.x + 330, slide.y + 210, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByRole("button", { name: "Undo move" })).toBeEnabled()
  await page.getByRole("button", { name: "Add text", exact: true }).click()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["add-box"] })).toBeEnabled()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Add slide" }).first().click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await page.locator('[data-slide-entry="1"]').click()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)

  for (const name of ["delete", "new", "add-box", "move", "text"] as const) {
    await page.getByRole("button", { name: undoCopy.undoNamed[name] }).click()
    await expect(page.getByRole("button", { name: undoCopy.redoNamed[name] })).toBeEnabled()
  }
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect(text).toHaveText("Hello")

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("undone.pptx")
  await (await saving).saveAs(file)
  const original = await partsOf(cleanFixture)
  const saved = await partsOf(file)
  expect([...saved.keys()]).toEqual([...original.keys()])
  const changedParts = [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changedParts.map(([name]) => name)).toEqual([])
})

test("an export after a layout placeholder's move is undone changes no part of the original", async ({
  page,
  context,
  stack,
}, testInfo) => {
  const fixture = join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx")
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await page.locator('[data-slide-entry="3"]').click()
  const title = page.locator('[data-canvas-element="ppt/slides/slide3.xml#3"]')
  const start = await title.boundingBox()
  if (start === null) throw new Error("title")
  await title.locator('[contenteditable="true"]').click()
  await page.keyboard.press("Escape")
  await page.keyboard.press("Shift+ArrowRight")
  await expect.poll(async () => (await title.boundingBox())?.x).not.toBe(start.x)
  await page.getByRole("button", { name: "Undo move" }).click()
  await expect.poll(async () => (await title.boundingBox())?.x).toBe(start.x)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("undone-layout.pptx")
  await (await saving).saveAs(file)
  const original = await partsOf(fixture)
  const saved = await partsOf(file)
  expect([...saved.keys()]).toEqual([...original.keys()])
  expect(
    [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name),
  ).toEqual([])
})
