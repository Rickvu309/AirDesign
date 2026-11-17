import { copyFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { openDeck, designing } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { shapeAt, partsOf } from "./shape-fills"

test("a person saves and removes a whole text element URL @export", async ({ page }, info) => {
  const { linkCopy } = await import("../../apps/web/src/copy/link-copy")
  await openDeck(page, "clean.pptx")
  const panel = await designing(page, shapeAt(page, "2"))
  const field = panel.getByRole("textbox", { name: linkCopy.target })
  await field.fill("https://example.com")
  await field.press("Enter")
  await expect(field).toHaveValue("https://example.com")
  await page.reload()
  await designing(page, shapeAt(page, "2"))
  await expect(field).toHaveValue("https://example.com")
  const download = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = info.outputPath("element-link.pptx")
  await (await download).saveAs(file)
  const { shownLink } = await import("../../packages/pptx/src/index")
  const bytes = await partsOf(file)
  const parts = new Map([...bytes].map(([name, value]) => [name, new Uint8Array(value)]))
  expect(shownLink(parts, { slide: "256", part: "ppt/slides/slide1.xml", shape: "2" })).toEqual({
    kind: "url",
    url: "https://example.com",
  })
  await copyFile(file, join(process.cwd(), "tests/browser/exported-element-link.pptx"))
  await shapeAt(page, "2").click()
  await page.keyboard.press("Escape")
  await field.fill("")
  await field.press("Enter")
  await expect(field).toHaveValue("")
})
