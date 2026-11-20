import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog.ts"
import { test } from "./deck-test"
import { placeText } from "./text-place"

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

export const hugExport = "exported-text-hug.pptx"

async function partXml(file: string, part: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => item.filename === part)
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error(part)
  return new TextDecoder().decode(bytes)
}

type Seen = {
  readonly frame: readonly number[]
  readonly selection: readonly number[] | null
  readonly text: readonly number[]
}

function seen(page: Page): Promise<Seen> {
  return page
    .locator('[data-slide-paint] [contenteditable="true"]')
    .last()
    .evaluate((node) => {
      const rect = (element: Element | null | undefined) => {
        const box = element?.getBoundingClientRect()
        return box === undefined ? null : [box.x, box.y, box.width, box.height].map((side) => Math.round(side))
      }
      const range = document.createRange()
      range.selectNodeContents(node)
      return {
        frame: rect(node.closest("[data-canvas-element]")) ?? [],
        selection: rect(document.querySelector("[data-slide-paint] [data-selection]")),
        text: [range.getBoundingClientRect().x, node.getBoundingClientRect().y].map((side) => Math.round(side)),
      }
    })
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("new text has no inset and hugs its text as it is typed, and the box it shows is the box it saves and exports @export", async ({
  page,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", hugExport)
  await rm(judged, { force: true })
  await decks.open()
  await placeText(page)
  const text = page.locator('[data-slide-paint] [contenteditable="true"]').last()
  await expect(text).toBeFocused()
  await page.keyboard.type("Hi", { delay: 20 })
  const short = await seen(page)
  expect(short.text).toEqual(short.frame.slice(0, 2))
  await page.keyboard.type(" there, this is the takeaway", { delay: 20 })
  await expect.poll(async () => (await seen(page)).frame[2]).toBeGreaterThan((short.frame[2] ?? 0) * 4)
  const long = await seen(page)
  expect(long.selection).toEqual(long.frame)
  for (let at = 0; at < 20; at += 1) await page.keyboard.press("Backspace")
  await expect(text).toHaveText("Hi there, ")
  await expect.poll(async () => (await seen(page)).frame[2]).toBeLessThan(long.frame[2] ?? 0)
  const kept = await seen(page)
  expect(kept.selection).toEqual(kept.frame)
  expect(kept.frame[3]).toBe(long.frame[3])
  await page.keyboard.press("Escape")
  await page.reload()
  await decks.ready()
  await expect(text).toHaveText("Hi there, ")
  expect((await seen(page)).frame).toEqual(kept.frame)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(hugExport)
  await (await saving).saveAs(file)
  await copyFile(file, judged)
  const xml = await partXml(file, "ppt/slides/slide1.xml")
  const added = xml.slice(xml.lastIndexOf("<p:sp>"))
  expect(added).toContain('<a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0" wrap="none"><a:spAutoFit/></a:bodyPr>')
  expect(added).not.toContain("algn=")
  const across = Number(/<p:sldSz cx="(\d+)"/.exec(await partXml(file, "ppt/presentation.xml"))?.[1])
  const slide = await page.locator("[data-slide-paint]").first().boundingBox()
  const width = Number(/<a:ext cx="(\d+)"/.exec(added)?.[1])
  expect(Math.abs((width / across) * (slide?.width ?? 0) - (kept.frame[2] ?? 0))).toBeLessThan(2)
})
