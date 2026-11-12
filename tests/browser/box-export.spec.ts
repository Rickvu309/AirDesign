import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { boxExpected, boxExportName, boxOriginalName } from "../../scripts/paragraph-export.mjs"

const fixture = join(process.cwd(), "scripts/pptx-fixtures", boxOriginalName)
const judged = join(process.cwd(), "tests/browser", boxExportName)
const { part: slide, box } = boxExpected

type ZipEntry = {
  readonly filename: string
  readonly directory: boolean
  getData(writer: unknown): Promise<Uint8Array>
}

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => {
    getEntries(): Promise<ZipEntry[]>
    close(): Promise<void>
  }
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

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

test.use({ viewport: { width: 1600, height: 1000 } })

async function drag(page: Page, from: { x: number; y: number }, by: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 })
  await page.mouse.up()
}

async function keptBox(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const all = database.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            database.close()
            const boxes = (all.result as { property?: string; value: unknown }[]).filter(
              (row) => row.property === "box",
            )
            resolve(boxes.at(-1)?.value ?? null)
          }
        }
      }),
  )
}

test("a box dragged and resized in the editor exports through the move and resize routes for the PowerPoint check @export", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  const download = testInfo.outputPath(boxExportName)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const slideBox = await page.locator("[data-slide-paint]").boundingBox()
  if (slideBox === null) throw new Error("no slide")
  const origin = { x: Math.round(slideBox.x), y: Math.round(slideBox.y) }
  await page.locator('[contenteditable="true"]').click()
  await drag(page, { x: origin.x + 300, y: origin.y + 150 }, { x: 30, y: 60 })
  await drag(page, { x: origin.x + 420, y: origin.y + 210 }, { x: -120, y: 60 })
  await expect.poll(() => keptBox(page)).toEqual(box)
  await page.reload()
  await settled(page)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export" }).click()
  await (await saving).saveAs(download)
  const original = await partsOf(fixture)
  const saved = await partsOf(download)
  expect([...saved.keys()]).toEqual([...original.keys()])
  expect(
    [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name),
  ).toEqual([slide])
  const written = saved.get(slide)?.toString("utf8") ?? ""
  expect(written).toContain(`<a:xfrm><a:off x="${box.x}" y="${box.y}"/><a:ext cx="${box.cx}" cy="${box.cy}"/></a:xfrm>`)
  expect(written.match(/<a:t>[^<]*<\/a:t>/g)).toEqual(["<a:t>Hello</a:t>"])
  await copyFile(download, judged)
})
