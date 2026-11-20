import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { groupCopy } from "../../apps/web/src/copy/arrange-copy"
import { test } from "./deck-test"

type ZipEntry = {
  readonly filename: string
  readonly directory: boolean
  getData(writer: unknown): Promise<Uint8Array>
}

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly ZipWriter: new (writer: unknown) => {
    add(name: string, reader: unknown): Promise<unknown>
    close(): Promise<Uint8Array>
  }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary
const part = "ppt/slides/slide1.xml"

test.use({ viewport: { width: 1600, height: 1000 } })

const line = '<a:p><a:r><a:rPr lang="en-US" sz="1800"/><a:t>A card line</a:t></a:r></a:p>'

const card = (id: number, y: number) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Card ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1828800" y="${y}"/><a:ext cx="3657600" cy="369332"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="DDEEFF"/></a:solidFill></p:spPr><p:txBody><a:bodyPr wrap="square"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${line}</p:txBody></p:sp>`

async function cardsDeck(): Promise<Buffer> {
  const reader = new zip.ZipReader(
    new zip.Uint8ArrayReader(new Uint8Array(await readFile(join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")))),
  )
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const entry of await reader.getEntries()) {
    if (entry.directory) continue
    let bytes = await entry.getData(new zip.Uint8ArrayWriter())
    if (entry.filename === part)
      bytes = new TextEncoder().encode(
        Buffer.from(bytes)
          .toString("utf8")
          .replace("</p:spTree>", `${card(20, 2743200)}${card(21, 3657600)}</p:spTree>`),
      )
    await writer.add(entry.filename, new zip.Uint8ArrayReader(bytes))
  }
  await reader.close()
  return Buffer.from(await writer.close())
}

function shape(page: Page, id: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(id)}"]`)
}

async function placed(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

test("a growing text box in an auto layout column pushes the next one down as it grows, shrinks back on Undo, and keeps both places through Redo and a reload", async ({
  page,
  decks,
}) => {
  await decks.open({
    name: "cards.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await cardsDeck(),
  })
  const [top, bottom] = [shape(page, 20), shape(page, 21)]
  await expect(bottom).toBeVisible()
  await top.click()
  await bottom.click({ modifiers: ["Shift"] })
  await page.keyboard.press("Shift+A")
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText(groupCopy.said.frame)
  const before = await placed(bottom)
  const gap = before.y - ((await placed(top)).y + (await placed(top)).height)
  await top.dblclick()
  await page.keyboard.press("Enter")
  await page.keyboard.press("End")
  for (const _ of [1, 2, 3]) {
    await page.keyboard.press("Enter")
    await page.keyboard.type("Another line")
  }
  await expect.poll(async () => (await placed(bottom)).y - before.y).toBeGreaterThan(40)
  await expect
    .poll(async () => {
      const grown = await placed(top)
      return Math.abs((await placed(bottom)).y - (grown.y + grown.height) - gap)
    })
    .toBeLessThan(2)
  await page.keyboard.press("Escape")
  const moved = await placed(bottom)
  await page.getByRole("button", { name: undoCopy.undoNamed.text, exact: true }).click()
  await expect(top).not.toContainText("Another line")
  await expect.poll(async () => Math.abs((await placed(bottom)).y - before.y)).toBeLessThan(2)
  await expect
    .poll(async () => {
      const shrunk = await placed(top)
      return Math.abs((await placed(bottom)).y - (shrunk.y + shrunk.height) - gap)
    })
    .toBeLessThan(2)
  await page.getByRole("button", { name: undoCopy.redoNamed.text, exact: true }).click()
  await expect.poll(async () => Math.abs((await placed(bottom)).y - moved.y)).toBeLessThan(2)
  await page.reload()
  await decks.ready()
  await expect.poll(async () => Math.abs((await placed(bottom)).y - moved.y)).toBeLessThan(2)
})
