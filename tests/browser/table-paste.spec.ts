import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { chartCopy } from "../../apps/web/src/copy/chart-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { openDeck } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { test } from "./deck-test"

type ZipEntry = { readonly filename: string; getData(writer: unknown): Promise<Uint8Array> }

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

test.use({ viewport: { width: 1600, height: 1000 } })

const sheet = "Criterion\tVendor A\tVendor B\nLicense cost\t$4.2M\t$3.1M\nCloud native\tYes\tPartial\n"

async function slideXml(file: string): Promise<string> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const entry = (await reader.getEntries()).find((item) => item.filename === "ppt/slides/slide1.xml")
  const bytes = entry === undefined ? undefined : await entry.getData(new zip.Uint8ArrayWriter())
  await reader.close()
  if (bytes === undefined) throw new Error("slide1.xml")
  return new TextDecoder().decode(bytes)
}

async function pasteInto(target: Locator, text: string): Promise<void> {
  await target.evaluate((node, pasted) => {
    const data = new DataTransfer()
    data.setData("text/plain", pasted)
    node.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
}

async function copiedFrom(page: Page): Promise<string> {
  return page.evaluate(() => {
    const data = new DataTransfer()
    document.activeElement?.dispatchEvent(
      new ClipboardEvent("copy", { clipboardData: data, bubbles: true, cancelable: true }),
    )
    return data.getData("text/plain")
  })
}

test("pastes spreadsheet cells on the slide as a table, fills it from a cell, copies picked cells out, and one Undo takes the table away @export", async ({
  page,
}, testInfo) => {
  await openDeck(page, "blank.pptx")
  const surface = page.locator("[data-slide-paint]")
  await surface.focus()
  await pasteInto(surface, sheet)
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table).toHaveAttribute("aria-rowcount", "3")
  await expect(table).toHaveAttribute("aria-colcount", "3")
  await expect(table.locator('[data-table-cell="1.2"]')).toContainText("$3.1M")
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await table.locator('[data-table-cell="2.1"]').dblclick()
  await pasteInto(table.locator('[data-table-text="2.1"]'), "No\tNo\tYes\nLow\tHigh\tLow")
  await expect(table).toHaveAttribute("aria-rowcount", "4")
  await expect(table).toHaveAttribute("aria-colcount", "4")
  await expect(table.locator('[data-table-cell="3.3"]')).toContainText("Low")
  await page.keyboard.press("Escape")
  await table.locator('[data-table-cell="0.1"]').click()
  await table.locator('[data-table-cell="1.2"]').click({ modifiers: [shortcutCopy.chord.other.shift] })
  await expect(table).toBeFocused()
  expect(await copiedFrom(page)).toBe("Vendor A\tVendor B\n$4.2M\t$3.1M")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath("table-paste.pptx")
  await (await saving).saveAs(file)
  const xml = await slideXml(file)
  for (const word of ["Criterion", "Vendor B", "$3.1M", "No", "High"]) expect(xml).toContain(`<a:t>${word}</a:t>`)
  expect([...xml.matchAll(/<a:tr /g)]).toHaveLength(4)
  await page.getByRole("button", { name: undoCopy.undoNamed["paste-layer"], exact: true }).click()
  await page.getByRole("button", { name: undoCopy.undoNamed["paste-layer"], exact: true }).click()
  await expect(table).toHaveCount(0)
})

test("pastes a block of cells into a chart's Data grid from the cell it lands in, adding rows and series", async ({
  page,
}) => {
  await openDeck(page, "blank.pptx")
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds.bar, exact: true }).click()
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const data = page.locator("[data-chart-data]")
  const label = data.getByRole("textbox", { name: chartCopy.category(1), exact: true })
  await label.focus()
  const rows = Array.from({ length: 6 }, (_, at) => `Year ${String(at + 1)}\t${String(at + 10)}\t${String(at + 20)}`)
  await pasteInto(label, `${rows.join("\n")}\n`)
  await expect(data.getByRole("textbox", { name: chartCopy.category(6), exact: true })).toHaveValue("Year 6")
  await expect(data.getByRole("textbox", { name: chartCopy.value(6, 2), exact: true })).toHaveValue("25")
  await expect(label).toHaveValue("Year 1")
})
