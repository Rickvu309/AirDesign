import { copyFile, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { storedValues } from "./device-store"
import { savedExport } from "./export-dialog.ts"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")
const exported = join(process.cwd(), "tests/browser/exported-text-format.pptx")
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

async function selectText(run: Locator, start: number, end: number): Promise<void> {
  await run.evaluate(
    (node, [from, to]) => {
      const text = node.firstChild
      if (text !== null) window.getSelection()?.setBaseAndExtent(text, from ?? 0, text, to ?? 0)
    },
    [start, end],
  )
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("font size, theme colour, alignment and bullets survive reload, undo and export @export", async ({
  page,
}, testInfo) => {
  const download = testInfo.outputPath("exported-text-format.pptx")
  await open(page, fixture)
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially("Hello world", { delay: 30 })
  await selectText(editor.locator("[data-run]").first(), 6, 11)
  await page.getByRole("button", { name: "Larger" }).click()
  const word = editor.locator("[data-run]").filter({ hasText: /^world$/ })
  await expect(word).toHaveAttribute("data-size", "3300")
  await expect(editor).toBeFocused()
  await page.getByRole("button", { name: "Text color" }).click()
  await page.locator("[data-color-picker]").getByRole("button", { name: "Accent 2", exact: true }).click()
  await expect(word).toHaveAttribute("data-color", "scheme:accent2")
  await page.getByRole("radio", { name: "Align center" }).click()
  await expect(page.getByRole("radio", { name: "Align center" })).toHaveAttribute("aria-checked", "true")
  await page.getByRole("button", { name: "Bullets" }).click()
  await expect(page.getByRole("button", { name: "Bullets" })).toHaveAttribute("aria-pressed", "true")
  await expect(editor).toBeFocused()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.getByRole("button", { name: "Bullets" })).toHaveAttribute("aria-pressed", "false")
  await expect(page.getByRole("radio", { name: "Align center" })).toHaveAttribute("aria-checked", "true")
  await page.keyboard.press("ControlOrMeta+Shift+Z")
  await expect(page.getByRole("button", { name: "Bullets" })).toHaveAttribute("aria-pressed", "true")
  await expect
    .poll(async () =>
      (await storedValues(page)).some(
        (value) =>
          value.includes('"size":3300') && value.includes('"scheme":"accent2"') && value.includes('"bullet":true'),
      ),
    )
    .toBe(true)
  await page.reload()
  await settled(page)
  const reloaded = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(reloaded.locator("[data-run]").filter({ hasText: /^world$/ })).toHaveAttribute("data-size", "3300")
  await expect(reloaded.locator("[data-color='scheme:accent2']")).toHaveText("world")
  await expect(reloaded.locator("[data-align='center']")).toBeVisible()
  await expect(reloaded.locator("[data-bullet='true']")).toBeVisible()
  await savedExport(page, download)
  expect(await changedParts(fixture, download)).toEqual([slide])
  const saved = (await partsOf(download)).get(slide)?.toString("utf8") ?? ""
  expect(saved).toContain('sz="3200"')
  expect(saved).toContain('sz="3300"')
  expect(saved).toContain('<a:schemeClr val="accent2"/>')
  expect(saved).toContain('<a:schemeClr val="dk1"/>')
  expect(saved).toContain('algn="ctr"')
  expect(saved).toContain('<a:buChar char="•"/>')
  expect(saved).toContain("<a:t>Hello </a:t>")
  expect(saved).toContain("<a:t>world</a:t>")
  await copyFile(download, exported)
})
