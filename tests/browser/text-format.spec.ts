import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { stored, storedValues } from "./device-store"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")
const slide = "ppt/slides/slide1.xml"
const deckAddress = /\/deck\/[A-Za-z0-9_-]{1,64}$/

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

async function changedParts(before: string, after: string): Promise<string[]> {
  const original = await partsOf(before)
  const saved = await partsOf(after)
  expect([...saved.keys()]).toEqual([...original.keys()])
  return [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name)
}

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function open(page: Page, file: string): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await expect(page).toHaveURL(deckAddress)
  await settled(page)
}

async function saveExport(page: Page, file: string): Promise<void> {
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export" }).click()
  await (await download).saveAs(file)
}

async function selectText(run: Locator, start: number, end: number): Promise<void> {
  await run.evaluate(
    (node, [from, to]) => {
      const text = node.firstChild
      if (text !== null) window.getSelection()?.setBaseAndExtent(text, from ?? 0, text, to ?? 0)
    },
    [start, end],
  )
}

function looks(run: Locator): Promise<string[]> {
  return run.evaluate((node) => {
    const style = getComputedStyle(node)
    return [style.fontWeight, style.fontStyle, style.textDecorationLine]
  })
}

function formatButton(page: Page, name: string): Locator {
  return page.getByRole("group", { name: "Text format" }).getByRole("button", { name })
}

const formatted = ["700", "italic", "underline"]
const unformatted = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Hello" }] }])

test.use({ viewport: { width: 1600, height: 1000 } })

test("a word made bold, italic and underlined survives reload, export and import", async ({ page }, testInfo) => {
  const download = testInfo.outputPath("formatted.pptx")
  await open(page, fixture)
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially("Hello world", { delay: 30 })
  await stored(page, "Hello world")
  await selectText(editor.locator("[data-run]").first(), 6, 11)
  await expect(formatButton(page, "Bold")).toHaveAttribute("aria-pressed", "false")
  await formatButton(page, "Bold").click()
  await expect(formatButton(page, "Bold")).toHaveAttribute("aria-pressed", "true")
  await expect(editor).toBeFocused()
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe("world")
  await page.keyboard.press("ControlOrMeta+i")
  await formatButton(page, "Underline").click()
  const word = editor.locator("[data-run]").filter({ hasText: /^world$/ })
  await expect.poll(() => looks(word)).toEqual(formatted)
  expect(await looks(editor.locator("[data-run]").first())).toEqual(["400", "normal", "none"])
  await expect
    .poll(async () => (await storedValues(page)).some((value) => value.includes('"underline":true')))
    .toBe(true)
  await page.reload()
  await settled(page)
  const reloaded = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(reloaded).toHaveText("Hello world")
  await expect.poll(() => looks(reloaded.locator("[data-run]").filter({ hasText: /^world$/ }))).toEqual(formatted)
  await expect
    .poll(() =>
      looks(
        page
          .locator("[data-thumb-paint] span")
          .filter({ hasText: /^world$/ })
          .first(),
      ),
    )
    .toEqual(formatted)
  await saveExport(page, download)
  expect(await changedParts(fixture, download)).toEqual([slide])
  const saved = (await partsOf(download)).get(slide)?.toString("utf8") ?? ""
  const fill = '<a:solidFill><a:schemeClr val="dk1"/></a:solidFill></a:rPr>'
  expect(saved).toContain(
    `<a:r><a:rPr lang="en-US" sz="3200">${fill}<a:t>Hello </a:t></a:r><a:r><a:rPr lang="en-US" sz="3200" b="1" i="1" u="sng">${fill}<a:t>world</a:t></a:r>`,
  )
  await open(page, download)
  const imported = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect.poll(() => looks(imported.locator("[data-run]").filter({ hasText: /^world$/ }))).toEqual(formatted)
})

test("bold turned on and off exports the file byte for byte, and each turn is one undo step", async ({
  page,
}, testInfo) => {
  const download = testInfo.outputPath("bold-twice.pptx")
  await open(page, fixture)
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("ControlOrMeta+b")
  const run = editor.locator("[data-run]").first()
  await expect.poll(() => looks(run)).toEqual(["700", "normal", "none"])
  await expect(page.getByRole("button", { name: "Undo text edit" })).toBeEnabled()
  await page.keyboard.press("ControlOrMeta+b")
  await expect.poll(() => looks(run)).toEqual(["400", "normal", "none"])
  await expect(formatButton(page, "Bold")).toHaveAttribute("aria-pressed", "false")
  await expect.poll(async () => (await storedValues(page)).filter((value) => value.includes('"bold"')).length).toBe(1)
  await expect.poll(async () => (await storedValues(page)).some((value) => value === unformatted)).toBe(true)
  await saveExport(page, download)
  expect(await changedParts(fixture, download)).toEqual([])
  await page.getByRole("button", { name: "Undo text edit" }).click()
  await expect.poll(() => looks(editor.locator("[data-run]").first())).toEqual(["700", "normal", "none"])
})
