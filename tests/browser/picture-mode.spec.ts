import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { boxCopy } from "../../apps/web/src/copy/box-copy"
import { openDeck, unfold } from "./design-panel"
import { savedExport } from "./export-dialog"
import { partsOf } from "./shape-fills"

const part = "ppt/slides/slide1.xml"

test("a person changes a picture's fill mode and exports its native placement @export", async ({ page }) => {
  const { picturePanelCopy: pictureCopy, pictureWords } = await import("../../apps/web/src/copy/picture-panel-copy")
  await openDeck(page, "picture-png.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const picture = page.locator(`[data-slide-paint] [data-canvas-element="${part}#4"]`)
  await picture.click({ position: { x: 8, y: 8 } })
  const panel = page.locator("[data-design-element]")
  await unfold(panel, boxCopy.section)
  const width = panel.getByRole("textbox", { name: boxCopy.w, exact: true })
  await width.fill("320")
  await width.press("Enter")
  let fitted = ""
  for (const mode of ["fit", "fill", "crop", "tile"] as const) {
    await panel.getByRole("combobox", { name: pictureCopy.mode, exact: true }).click()
    await page.getByRole("option", { name: pictureWords[mode], exact: true }).click()
    await expect(panel.getByRole("combobox", { name: pictureCopy.mode, exact: true })).toContainText(
      pictureWords[mode]!,
    )
    const size = () => picture.evaluate((node) => getComputedStyle(node).backgroundSize)
    if (mode === "fit") fitted = await size()
    if (mode === "fill") await expect.poll(size).not.toBe(fitted)
    const file = join(process.cwd(), "tests/browser", `exported-picture-${mode}.pptx`)
    await savedExport(page, file)
    const parts = await partsOf(file)
    expect(parts.get(part)?.toString()).toContain(mode === "tile" ? "<a:tile " : "<a:stretch>")
    if (mode === "crop") expect(parts.get(part)?.toString()).toContain("<a:srcRect")
  }
})
