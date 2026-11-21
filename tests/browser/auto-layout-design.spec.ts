import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { frameCopy, layoutWords } from "../../apps/web/src/copy/frame-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { exportFromDialog } from "./export-dialog"
import { openDeck, setPanelMode } from "./design-panel"
import { covers } from "./gesture"

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
const original = join(process.cwd(), "scripts/pptx-fixtures/frame.pptx")
const exportName = "exported-frame-layout.pptx"
const part = "ppt/slides/slide1.xml"

async function partsOf(file: string): Promise<Map<string, Buffer>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Buffer>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return parts
}

function painted(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(shape)}"]`)
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("not painted")
  return box
}

async function typed(field: Locator, value: string): Promise<void> {
  await field.fill(value)
  await field.press("Enter")
}

test.use({ viewport: { width: 1600, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await openDeck(page, "frame.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await setPanelMode(page, "design")
  await painted(page, 4).click()
})

test("shows nine alignments in three rows and moves the selection with arrow keys", async ({ page }) => {
  const alignment = page.getByRole("group", { name: frameCopy.align, exact: true })
  const choices = alignment.getByRole("button")
  await expect(choices).toHaveCount(9)
  const rows = await choices.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().y))
  expect([...new Set(rows)].map((row) => rows.filter((y) => y === row).length)).toEqual([3, 3, 3])
  await choices.first().click()
  await expect(choices.first()).toHaveAttribute("aria-pressed", "true")
  await choices.first().press("ArrowDown")
  await expect(choices.nth(3)).toHaveAttribute("aria-pressed", "true")
  await expect(choices.nth(3)).toBeFocused()
})

test("edits opposite padding sides together and reveals their individual values", async ({ page }) => {
  const padding = page.getByRole("group", { name: frameCopy.padding, exact: true })
  const horizontal = padding.getByRole("textbox", { name: layoutWords["padding.horizontal"] })
  const vertical = padding.getByRole("textbox", { name: layoutWords["padding.vertical"] })
  const individual = padding.getByRole("button", { name: frameCopy.individualPadding })
  await expect(padding.getByRole("textbox")).toHaveCount(2)
  await typed(horizontal, "14")
  await typed(vertical, "9")
  await individual.click()
  for (const [side, value] of [
    ["left", "14"],
    ["top", "9"],
    ["right", "14"],
    ["bottom", "9"],
  ] as const) {
    await expect(padding.getByRole("textbox", { name: layoutWords[`padding.${side}`], exact: true })).toHaveValue(value)
  }
  await typed(padding.getByRole("textbox", { name: layoutWords["padding.left"], exact: true }), "8")
  await individual.click()
  await expect(horizontal).toHaveValue("")
  await expect(horizontal).toHaveAttribute("placeholder", designCopy.mixed)
  await expect(vertical).toHaveValue("9")
  await typed(horizontal, "12")
  await individual.click()
  for (const side of ["left", "right"] as const) {
    await expect(padding.getByRole("textbox", { name: layoutWords[`padding.${side}`], exact: true })).toHaveValue("12")
  }
})

test("uses the same muted 9 px label above every Auto layout control", async ({ page }) => {
  const section = page
    .locator("[data-design-section]")
    .filter({ has: page.getByText(frameCopy.autoLayout, { exact: true }) })
  const labels = [frameCopy.gap, frameCopy.padding, frameCopy.flow, frameCopy.align]
  const styles = await Promise.all(
    labels.map(async (name) => {
      const label = section.getByText(name, { exact: true })
      await expect(label).toBeVisible()
      return label.evaluate((node) => {
        const { fontSize, color, lineHeight } = getComputedStyle(node)
        return { fontSize, color, lineHeight }
      })
    }),
  )
  expect(styles.map((style) => style.fontSize)).toEqual(labels.map(() => "9px"))
  expect(styles).toEqual(labels.map(() => styles[0]))
})

test("design mode's Auto layout section sets direction, gap, padding and alignment, and the export keeps them @export", async ({
  page,
}, testInfo) => {
  covers("auto-layout")
  const judged = join(process.cwd(), "tests/browser", exportName)
  await rm(judged, { force: true })
  const [square, oval] = [painted(page, 4), painted(page, 5)]
  const panel = page.locator("[data-design-panel]")
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
  await panel
    .getByRole("group", { name: frameCopy.flow })
    .getByRole("button", { name: layoutWords["flow.vertical"] })
    .click()
  await expect
    .poll(async () => (await boxOf(oval)).y > (await boxOf(square)).y + (await boxOf(square)).height - 1)
    .toBe(true)
  await page.getByRole("button", { name: undoCopy.undoNamed["auto-layout"], exact: true }).click()
  await expect.poll(async () => Math.abs((await boxOf(oval)).y - (await boxOf(square)).y) <= 1.5).toBe(true)
  await page.getByRole("button", { name: undoCopy.redoNamed["auto-layout"], exact: true }).click()
  await expect
    .poll(async () => (await boxOf(oval)).y > (await boxOf(square)).y + (await boxOf(square)).height - 1)
    .toBe(true)
  await typed(panel.getByRole("textbox", { name: frameCopy.gap, exact: true }), "16")
  const padding = panel.getByRole("group", { name: frameCopy.padding, exact: true })
  await padding.getByRole("button", { name: frameCopy.individualPadding }).click()
  await typed(padding.getByRole("textbox", { name: layoutWords["padding.left"] }), "8")
  const center = panel
    .getByRole("group", { name: frameCopy.align, exact: true })
    .getByRole("button", { name: layoutWords["align.center"], exact: true })
  await center.click()
  await expect(center).toHaveAttribute("aria-pressed", "true")
  const [top, bottom] = [await boxOf(square), await boxOf(oval)]
  expect(Math.abs(top.x + top.width / 2 - (bottom.x + bottom.width / 2))).toBeLessThanOrEqual(1.5)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(exportName)
  await (await saving).saveAs(download)
  const before = await partsOf(original)
  const after = await partsOf(download)
  const changed = [...before].filter(([name, bytes]) => after.get(name)?.equals(bytes) !== true).map(([name]) => name)
  expect(changed.sort()).toEqual([part, "ppt/tags/tag1.xml"].sort())
  expect([...after.keys()].filter((name) => !before.has(name))).toEqual([])
  expect(after.get("ppt/tags/tag1.xml")?.toString("utf8")).toContain(";f=v;g=203200;p=101600,0,0,0;a=center;")
  await copyFile(download, judged)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(download)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await setPanelMode(page, "design")
  await painted(page, 4).click()
  const reopened = page.locator("[data-design-panel]")
  await expect(
    reopened.getByRole("group", { name: frameCopy.flow }).getByRole("button", { name: layoutWords["flow.vertical"] }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(reopened.getByRole("textbox", { name: frameCopy.gap, exact: true })).toHaveValue("16")
})
