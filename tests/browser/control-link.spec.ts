import { copyFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { openDeck, designing } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { shapeAt, partsOf } from "./shape-fills"
import { linkCopy } from "../../apps/web/src/copy/link-copy.ts"
import { presentCopy } from "../../apps/web/src/copy/present-copy"

test("a person saves and removes a whole text element URL @export", async ({ page }, info) => {
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
  const { shownLink } = await import("../../packages/pptx/src/index.ts")
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

test("a person links selected words, sees Mixed, and picks a stable slide @export", async ({ page }, info) => {
  await openDeck(page, "clean.pptx")
  const shape = shapeAt(page, "2")
  const panel = await designing(page, shape)
  await shape.dblclick()
  const editor = shape.locator('[contenteditable="true"]')
  await editor.fill("one two three")
  await editor.evaluate((box) => {
    const text = box.querySelector("[data-run]")?.firstChild ?? box.firstChild
    if (text === null) throw new Error("text")
    const range = document.createRange()
    range.setStart(text, 4)
    range.setEnd(text, 7)
    const selection = document.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event("selectionchange"))
  })
  const field = panel.getByRole("textbox", { name: linkCopy.target })
  await panel.getByRole("button", { name: linkCopy.create }).click()
  await field.fill("https://example.com/phrase")
  await field.press("Enter")
  await expect(field).toHaveValue("https://example.com/phrase")
  await expect(editor.locator("[data-link]")).toHaveText("two")
  await editor.focus()
  await page.keyboard.press("ControlOrMeta+a")
  await expect(field).toHaveValue(linkCopy.mixed)
  await page.keyboard.press("Escape")
  await shape.click()
  await panel.getByRole("button", { name: linkCopy.slides }).click()
  await page.getByRole("menuitem", { name: `${linkCopy.slide} 1`, exact: true }).click()
  await expect(field).toHaveValue("1")
  await page.reload()
  await designing(page, shape)
  await expect(field).toHaveValue("1")
  const download = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = info.outputPath("phrase-link.pptx")
  await (await download).saveAs(file)
  await copyFile(file, join(process.cwd(), "tests/browser/exported-phrase-link.pptx"))
  const { shownLink } = await import("../../packages/pptx/src/index.ts")
  const bytes = await partsOf(file)
  const parts = new Map([...bytes].map(([name, value]) => [name, new Uint8Array(value)]))
  expect(shownLink(parts, { slide: "256", part: "ppt/slides/slide1.xml", shape: "2", paragraph: 0, run: 1 })).toEqual({
    kind: "url",
    url: "https://example.com/phrase",
  })
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: presentCopy.present, exact: true }).click()
  const phrase = page.locator("[data-present-show] a[data-text-link]")
  await expect(phrase).toHaveText("two")
  const box = await phrase.boundingBox()
  if (box === null) throw new Error("phrase")
  await page.context().route("https://example.com/**", (route) => route.fulfill({ body: "Opened" }))
  const popup = page.waitForEvent("popup")
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const opened = await popup
  await expect(opened).toHaveURL("https://example.com/phrase")
  await opened.close()
})
