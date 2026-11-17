import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { openDeck } from "./design-panel"
import { savedExport } from "./export-dialog"
import { partsOf } from "./shape-fills"

const part = "ppt/slides/slide1.xml"

test("a person changes a picture's fill mode and exports its native placement @export", async ({ page }) => {
  const { pictureCopy, pictureWords } = await import("../../apps/web/src/copy/picture-copy")
  await openDeck(page, "picture-png.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const picture = page.locator(`[data-slide-paint] [data-canvas-element="${part}#4"]`)
  await picture.click({ position: { x: 8, y: 8 } })
  const panel = page.locator("[data-design-element]")
  for (const mode of ["fill", "fit", "crop", "tile"] as const) {
    await panel.getByRole("combobox", { name: pictureCopy.mode, exact: true }).click()
    await page.getByRole("option", { name: pictureWords[mode], exact: true }).click()
    await expect(panel.getByRole("combobox", { name: pictureCopy.mode, exact: true })).toContainText(
      pictureWords[mode]!,
    )
    const file = join(process.cwd(), "tests/browser", `exported-picture-${mode}.pptx`)
    await savedExport(page, file)
    const parts = await partsOf(file)
    expect(parts.get(part)?.toString()).toContain(mode === "tile" ? "<a:tile " : "<a:stretch>")
    if (mode === "crop") expect(parts.get(part)?.toString()).toContain("<a:srcRect")
  }
})
