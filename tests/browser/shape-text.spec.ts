import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect } from "@playwright/test"
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

test.use({ viewport: { width: 1600, height: 1000 } })

test("Enter or a double-click on a drawn shape types in it, and its letters never pick tools @export", async ({
  page,
  decks,
}, testInfo) => {
  await decks.blank()
  const slide = page.locator("[data-slide-paint]").first()
  const layers = slide.locator("[data-canvas-element]")
  await slide.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("r")
  await expect(layers).toHaveCount(1)
  await page.keyboard.press("Enter")
  const typing = slide.locator('[contenteditable="true"]:focus')
  await expect(typing).toHaveCount(1)
  await page.keyboard.type("Sales up", { delay: 20 })
  await expect(typing).toHaveText("Sales up")
  await expect(layers).toHaveCount(1)
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")

  await slide.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("o")
  await expect(layers).toHaveCount(2)
  await page.keyboard.press("Escape")
  const ellipse = layers.last()
  await ellipse.dblclick()
  await expect(typing).toHaveCount(1)
  await page.keyboard.type("Costs", { delay: 20 })
  await expect(ellipse.locator('[contenteditable="true"]')).toHaveText("Costs")
  await expect(layers).toHaveCount(2)
  await page.keyboard.press("Escape")

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("shape-text.pptx")
  await (await saving).saveAs(file)
  const xml = await slideXml(file)
  for (const words of ["Sales up", "Costs"])
    expect(xml).toMatch(
      new RegExp(`<a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r>.*?<a:t>${words}</a:t>`),
    )
})
