import { expect, test, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { textCopy } from "../../apps/web/src/copy/text-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { openDeck, settled } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { partsOf } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

async function runSizes(page: Page): Promise<string[]> {
  return page
    .locator("[data-slide-paint] [data-run]")
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).style.fontSize))
}

async function openSlide(page: Page, number: number): Promise<void> {
  const entry = page.locator(`[data-slide-entry="${String(number)}"]`)
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
}

function titleSize(xml: string): string | undefined {
  const block = /<p:titleStyle\b[^>]*>[\s\S]*?<\/p:titleStyle>/.exec(xml)?.[0]
  return block === undefined ? undefined : /sz="(\d+)"/.exec(block)?.[1]
}

function masterTitleSizes(parts: ReadonlyMap<string, Buffer>): string[] {
  return [...parts]
    .filter(([name]) => name.startsWith("ppt/slideMasters/"))
    .flatMap(([, bytes]) => {
      const size = titleSize(bytes.toString("utf8"))
      return size === undefined ? [] : [size]
    })
}

test("edits the Title style, keeps explicit sizes, and undoes once @export", async ({ page }, info) => {
  test.setTimeout(180_000)
  await openDeck(page, "doe-heat-pumps.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const explicit = await runSizes(page)
  expect(explicit.length).toBeGreaterThan(1)
  await openSlide(page, 12)
  const inheriting = await runSizes(page)
  expect(inheriting.length).toBeGreaterThan(0)

  await page.getByRole("button", { name: designCopy.editTemplateStyle, exact: true }).click()
  const dialog = page.locator("[data-template-style-dialog]")
  await dialog.getByRole("button", { name: /^Title [^·]/ }).click()
  const editor = page.locator("[data-text-style]")
  const size = editor.getByRole("textbox", { name: textCopy.size, exact: true })
  await size.fill("32")
  await size.press("Tab")
  await editor.getByRole("button", { name: productCopy.close, exact: true }).click()
  await dialog.getByRole("button", { name: productCopy.close, exact: true }).click()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["text-style"], exact: true })).toBeVisible()
  await expect.poll(() => runSizes(page)).not.toEqual(inheriting)
  await openSlide(page, 1)
  await expect.poll(() => runSizes(page)).toEqual(explicit)
  await openSlide(page, 12)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = info.outputPath("exported-text-style.pptx")
  await (await saving).saveAs(file)
  expect(masterTitleSizes(await partsOf(file))).toContain("3200")

  await page.getByRole("button", { name: undoCopy.undoNamed["text-style"], exact: true }).click()
  await expect.poll(() => runSizes(page)).toEqual(inheriting)
  await page.reload()
  await settled(page)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await openSlide(page, 12)
  await expect.poll(() => runSizes(page)).toEqual(inheriting)
  const restored = page.waitForEvent("download")
  await exportFromDialog(page)
  const again = info.outputPath("restored-text-style.pptx")
  await (await restored).saveAs(again)
  expect(masterTitleSizes(await partsOf(again))).not.toContain("3200")
  expect(masterTitleSizes(await partsOf(again))).toContain("4400")
})
