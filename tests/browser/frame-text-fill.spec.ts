import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { groupCopy } from "../../apps/web/src/copy/arrange-copy"
import { frameCopy, layoutWords, sizingShown } from "../../apps/web/src/copy/frame-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { setPanelMode } from "./design-panel"
import { covers } from "./gesture"
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

const words = (text: string) => `<a:p><a:r><a:rPr lang="en-US" sz="1800"/><a:t>${text}</a:t></a:r></a:p>`

const card = (id: number, y: number, line: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Card ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1828800" y="${y}"/><a:ext cx="5486400" cy="369332"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="DDEEFF"/></a:solidFill></p:spPr><p:txBody><a:bodyPr wrap="square"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${line}</p:txBody></p:sp>`

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
          .replace(
            "</p:spTree>",
            `${card(20, 2743200, words("A longer card line that wraps onto more lines once the frame is made much narrower"))}${card(21, 3657600, words("A card line"))}</p:spTree>`,
          ),
      )
    await writer.add(entry.filename, new zip.Uint8ArrayReader(bytes))
  }
  await reader.close()
  return Buffer.from(await writer.close())
}

function shape(page: Page, id: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(id)}"]`)
}

type Laid = Window & { laidHeights?: number[] }

async function watchHeights(locator: Locator) {
  await locator.evaluate((card) => {
    const heights: number[] = []
    new ResizeObserver(() => heights.push(card.getBoundingClientRect().height)).observe(card)
    Object.assign(window, { laidHeights: heights })
  })
}

async function laidHeights(page: Page): Promise<number[]> {
  return (await page.evaluate(() => (window as Laid).laidHeights ?? [])).map(Math.round)
}

async function placed(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

test("a text card that fills a column frame wraps to the frame's width and hugs its lines, and the next card follows live, through Undo and a reload", async ({
  page,
  decks,
}) => {
  covers("resize", "auto-layout")
  await decks.open({
    name: "cards.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await cardsDeck(),
  })
  const [top, bottom] = [shape(page, 20), shape(page, 21)]
  await expect(bottom).toBeVisible()
  await top.click()
  await bottom.click({ modifiers: [shortcutCopy.chord.other.shift] })
  await page.keyboard.press("Shift+A")
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText(groupCopy.said.frame)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await setPanelMode(page, "design")
  const selection = page.locator("[data-slide-paint] [data-selection]")
  await top.click({ position: { x: 5, y: 5 } })
  await top.dblclick({ position: { x: 5, y: 5 } })
  await expect(selection).toHaveAttribute("data-selection", /\.20$/)
  await page.locator("[data-design-panel]").getByRole("combobox", { name: frameCopy.width, exact: true }).click()
  await page.getByRole("option", { name: layoutWords["width.fill"], exact: true }).click()
  await expect(page.getByRole("option")).toHaveCount(0)
  await top.click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("Escape")
  await expect(selection).not.toHaveAttribute("data-selection", /\.20$/)
  const [wide, below] = await Promise.all([top, bottom].map(placed))
  const gap = below.y - (wide.y + wide.height)
  const follows = async () => {
    const card = await placed(top)
    return Math.abs((await placed(bottom)).y - (card.y + card.height) - gap) < 2
  }

  const grip = await placed(page.locator("[data-selection] [data-grip='right']"))
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 - 280, grip.y + grip.height / 2, { steps: 12 })
  await expect.poll(async () => (await placed(top)).width).toBeLessThan(wide.width - 150)
  await expect.poll(async () => (await placed(top)).height).toBeGreaterThan(wide.height + 10)
  await expect.poll(follows).toBe(true)
  await watchHeights(top)
  await page.mouse.up()
  const narrow = await placed(top)
  await expect.poll(follows).toBe(true)
  await expect(
    page.locator("[data-design-panel]").getByRole("combobox", { name: frameCopy.height, exact: true }),
  ).toContainText(sizingShown["height.hug"])

  await page.getByRole("button", { name: undoCopy.undoNamed.resize, exact: true }).click()
  await expect.poll(async () => Math.abs((await placed(top)).height - wide.height)).toBeLessThan(2)
  await expect.poll(follows).toBe(true)
  await page.getByRole("button", { name: undoCopy.redoNamed.resize, exact: true }).click()
  await expect.poll(async () => Math.abs((await placed(top)).height - narrow.height)).toBeLessThan(2)
  expect(await laidHeights(page)).toEqual([narrow.height, wide.height, narrow.height].map(Math.round))
  await page.reload()
  await decks.ready()
  await expect.poll(async () => Math.abs((await placed(top)).width - narrow.width)).toBeLessThan(2)
  await expect.poll(async () => Math.abs((await placed(top)).height - narrow.height)).toBeLessThan(2)
  await expect.poll(follows).toBe(true)
})
