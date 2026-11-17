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
  const size = page.getByRole("textbox", { name: "Font size" })
  await size.click()
  await page.keyboard.type("33")
  await page.keyboard.press("Enter")
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

test("the text colour menu keeps the text box chosen while it is open and closes on a pick", async ({ page }) => {
  await open(page, fixture)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially("Hello world", { delay: 30 })
  await selectText(editor.locator("[data-run]").first(), 6, 11)
  const panel = page.locator("[data-design-element]")
  const frame = page.locator("[data-selection]")
  const picker = page.locator("[data-color-picker]")
  await expect(panel).toBeVisible()
  await expect(frame).toHaveCount(1)
  await page.locator("[data-editor-toolbar]").getByRole("button", { name: "Text color" }).click()
  await expect(picker).toBeVisible()
  await expect(panel).toBeVisible()
  await expect(frame).toHaveCount(1)
  await picker.getByRole("button", { name: "Accent 2", exact: true }).click()
  await expect(picker).toHaveCount(0)
  await expect(editor.locator("[data-color='scheme:accent2']")).toHaveText("world")
  await expect(editor).toBeFocused()
  await expect(panel).toBeVisible()
  await expect(frame).toHaveCount(1)
})

test("a size typed in the toolbar sets the selected words and puts the cursor back in the text", async ({ page }) => {
  await open(page, fixture)
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await editor.pressSequentially("Hello world", { delay: 30 })
  await selectText(editor.locator("[data-run]").first(), 6, 11)
  const size = page.getByRole("textbox", { name: "Font size" })
  await expect(size).toHaveValue("32")
  await size.click()
  await page.keyboard.type("10.5")
  await page.keyboard.press("Enter")
  const word = editor.locator("[data-run]").filter({ hasText: /^world$/ })
  await expect(word).toHaveAttribute("data-size", "1050")
  await expect(editor).toBeFocused()
  await expect(size).toHaveValue("10.5")
  await page.getByRole("button", { name: "Larger" }).click()
  await expect(word).toHaveAttribute("data-size", "1100")
  await size.fill("big")
  await size.press("Enter")
  await expect(word).toHaveAttribute("data-size", "1100")
  await expect(size).toHaveValue("11")
})

const nextControl: Readonly<Record<string, string>> = { Tab: "Larger", "Shift+Tab": "Smaller" }

for (const leave of ["Tab", "Shift+Tab", "canvas", "tray", "Enter", "Escape", "invalid"]) {
  test(`a typed font size handles ${leave} without changing another word`, async ({ page }) => {
    await open(page, fixture)
    const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
    await editor.click()
    await page.keyboard.press("ControlOrMeta+a")
    await editor.pressSequentially("Hello world")
    const originalSize = await editor
      .locator("[data-run]")
      .first()
      .evaluate((node) => getComputedStyle(node).fontSize)
    await selectText(editor.locator("[data-run]").first(), 6, 11)
    const size = page.getByRole("textbox", { name: "Font size" })
    await size.fill(leave === "invalid" ? "big" : "24.5")
    if (leave === "Tab" || leave === "Shift+Tab" || leave === "Enter" || leave === "Escape") await size.press(leave)
    if (leave === "tray") await page.getByRole("button", { name: "Shapes", exact: true }).click()
    if (leave === "canvas") await editor.click({ position: { x: 5, y: 5 } })
    const control = nextControl[leave]
    if (control !== undefined) await expect(page.getByRole("button", { name: control, exact: true })).toBeFocused()
    if (leave === "Enter") await expect(editor).toBeFocused()
    const committed = leave !== "Escape" && leave !== "invalid"
    if (committed) await expect(editor.locator('[data-run][data-size="2450"]')).toHaveText("world")
    if (leave === "tray") {
      await expect(size).toBeVisible()
      await expect(page.locator("[data-shape-tray]").getByRole("button", { name: "Line", exact: true })).toBeFocused()
      await page.keyboard.press("Escape")
    }
    if (control !== undefined || leave === "tray" || leave === "Escape" || leave === "invalid")
      await editor.click({ position: { x: 5, y: 5 } })
    if (committed) {
      await expect(editor.locator("[data-run]").filter({ hasText: /^Hello / })).toHaveCSS("font-size", originalSize)
      await editor.press("ControlOrMeta+z")
    }
    await expect(editor.locator('[data-run][data-size="2450"]')).toHaveCount(0)
    await expect(editor).toHaveText("Hello world")
  })
}
