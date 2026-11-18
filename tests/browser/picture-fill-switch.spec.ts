import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { openDeck, setPanelMode, settled } from "./design-panel"
import { savedExport } from "./export-dialog"
import { filled, partsOf } from "./shape-fills"

const part = "ppt/slides/slide1.xml"
const pictureKey = `${part}#4`
const identity = '<p:cNvPr id="4" name="Picture 4"/>'

function picture(page: Page): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${pictureKey}"]`)
}

function photo(page: Page): Promise<string> {
  return filled(picture(page))
}

async function designed(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await picture(page).click({ position: { x: 8, y: 8 } })
  const panel = page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  await setPanelMode(page, "slides")
  return panel
}

test("a person switches an imported photo to a solid, and back to the same photo @export", async ({ page }) => {
  test.setTimeout(90_000)
  await openDeck(page, "picture-png.pptx")
  const panel = await designed(page)
  await expect(panel).toHaveAttribute("data-panel-kind", "picture")
  await expect(panel.locator("[data-design-head]")).toContainText(designCopy.titles.picture)
  await expect.poll(() => photo(page)).toContain("url(")
  const kinds = panel.locator("[data-picture-kind]")
  await expect(kinds.getByRole("button")).toHaveCount(4)
  for (const name of [fillWords.none, fillWords.solid, fillWords.gradient, fillWords.image])
    await expect(kinds.getByRole("button", { name, exact: true })).toBeEnabled()
  await kinds.getByRole("button", { name: fillWords.solid, exact: true }).click()
  await expect.poll(() => photo(page)).not.toContain("url(")
  await expect(panel).toHaveAttribute("data-panel-kind", "shape")
  await expect(panel.locator("[data-design-head]")).toContainText(designCopy.square)

  await page.getByRole("button", { name: undoCopy.undoNamed.fill, exact: true }).click()
  await expect.poll(() => photo(page)).toContain("url(")
  await expect(panel).toHaveAttribute("data-panel-kind", "picture")
  await expect(panel.locator("[data-design-head]")).toContainText(designCopy.titles.picture)
  await page.getByRole("button", { name: undoCopy.redoNamed.fill, exact: true }).click()
  await expect.poll(() => photo(page)).not.toContain("url(")
  await expect(panel.locator("[data-design-head]")).toContainText(designCopy.square)

  await page.reload()
  await settled(page)
  await expect.poll(() => photo(page)).not.toContain("url(")
  const again = await designed(page)
  await expect(again).toHaveAttribute("data-panel-kind", "shape")
  await expect(again.locator("[data-design-head]")).toContainText(designCopy.square)

  const file = join(process.cwd(), "tests/browser", "exported-picture-fill-switch.pptx")
  await savedExport(page, file)
  const xml = (await partsOf(file)).get(part)?.toString() ?? ""
  const at = xml.indexOf(identity)
  expect(at).toBeGreaterThan(-1)
  expect(xml.lastIndexOf("<p:sp", at)).toBeGreaterThan(xml.lastIndexOf("<p:pic", at))
  expect(xml.slice(at, xml.indexOf("</p:sp>", at))).not.toContain("blipFill")

  const restored = await designed(page)
  await restored
    .getByRole("group", { name: fillCopy.value, exact: true })
    .getByRole("button", { name: fillWords.image, exact: true })
    .click()
  await expect.poll(() => photo(page)).toContain("url(")
  await expect(restored).toHaveAttribute("data-panel-kind", "picture")
  await page.getByRole("button", { name: undoCopy.undoNamed.fill, exact: true }).click()
  await expect.poll(() => photo(page)).not.toContain("url(")
})
