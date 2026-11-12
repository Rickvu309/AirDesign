import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { boxExpected, boxExportName, boxOriginalName } from "../../scripts/paragraph-export.mjs"

const fixture = join(process.cwd(), "scripts/pptx-fixtures", boxOriginalName)
const judged = join(process.cwd(), "tests/browser", boxExportName)
const { part: slide, element, box } = boxExpected

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
    const deck = location.pathname.match(/^\/thin\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("a box kept on the device exports through the move and resize routes for the PowerPoint check", async ({
  page,
}, testInfo) => {
  await rm(judged, { force: true })
  const download = testInfo.outputPath(boxExportName)
  await page.goto("/thin")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/thin\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const address = page.url()
  const deck = address.split("/").pop() ?? ""
  await page.goto("/live-proof")
  const kept = await page.evaluate(([named, value, id]) => globalThis.airdesignLive.enqueueBox(named, value, id), [
    deck,
    box,
    element,
  ] as const)
  expect(kept).toEqual({ ok: true, painted: box })
  await page.goto(address)
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
