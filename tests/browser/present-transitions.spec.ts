import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

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

const changes: Readonly<Record<string, (xml: string) => string>> = {
  "ppt/slides/slide1.xml": (xml) => xml.replace(/<p:sld\b/, '<p:sld show="0"'),
  "ppt/slides/slide3.xml": (xml) => xml.replace(/<p:sld\b/, '<p:sld show="0"'),
  "ppt/slides/slide4.xml": (xml) =>
    xml.replace("</p:sld>", '<p:transition spd="slow"><p:push dir="u"/></p:transition></p:sld>'),
}

async function showDeck(): Promise<Buffer> {
  const reader = new zip.ZipReader(
    new zip.Uint8ArrayReader(
      new Uint8Array(await readFile(join(process.cwd(), "scripts/pptx-fixtures/nasa-1d-cnn.pptx"))),
    ),
  )
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const entry of await reader.getEntries()) {
    if (entry.directory) continue
    let bytes = await entry.getData(new zip.Uint8ArrayWriter())
    const change = changes[entry.filename]
    if (change !== undefined) bytes = new TextEncoder().encode(change(Buffer.from(bytes).toString("utf8")))
    await writer.add(entry.filename, new zip.Uint8ArrayReader(bytes))
  }
  await reader.close()
  return Buffer.from(await writer.close())
}

test.use({ viewport: { width: 1600, height: 1000 } })

async function presented(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "show.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await showDeck(),
  })
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
  await page.locator('[data-slide-entry="2"]').click()
  await page.getByRole("button", { name: "Present", exact: true }).click()
  await expect(shown(page)).toHaveAttribute("data-present-slide", "2")
}

function shown(page: Page) {
  return page.locator("[data-present-show] [data-present-slide]")
}

function leaving(page: Page) {
  return page.locator("[data-present-leaving]")
}

test("a show skips hidden slides, shows one asked for by number, and plays the file's push", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await presented(page)
  await page.keyboard.press("ArrowRight")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "4")
  await expect(leaving(page)).toHaveAttribute("data-present-leaving", "2")
  await expect(leaving(page)).toHaveCount(0)
  await page.keyboard.press("ArrowLeft")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "2")
  await expect(leaving(page)).toHaveCount(0)
  await page.keyboard.press("3")
  await page.keyboard.press("Enter")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "3")
})

test("with reduced motion the next slide comes in with no transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await presented(page)
  await page.keyboard.press("ArrowRight")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "4")
  expect(await leaving(page).count()).toBe(0)
})

test("starting from the beginning skips a hidden first slide", async ({ page }) => {
  await presented(page)
  await page.keyboard.press("Escape")
  await page.keyboard.press("F5")
  await expect(shown(page)).toHaveAttribute("data-present-slide", "2")
})
