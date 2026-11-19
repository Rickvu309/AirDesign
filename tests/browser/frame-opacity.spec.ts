import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { frameCopy } from "../../apps/web/src/copy/frame-copy"
import { opacityCopy } from "../../apps/web/src/copy/opacity-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { openDeck, settled } from "./design-panel"
import { exportFromDialog } from "./export-dialog"
import { covers } from "./gesture"
import { filled, partsOf } from "./shape-fills"

const exportName = "exported-frame-faded.pptx"
const part = "ppt/slides/slide1.xml"
const layers = [3, 4, 5]

test.use({ viewport: { width: 1600, height: 1000 } })

function painted(page: Page, shape: number): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${String(shape)}"]`)
}

function fadedLayer(page: Page): Locator {
  return page.locator("[data-slide-paint] [data-group-effects]")
}

async function heldShapes(page: Page): Promise<readonly string[]> {
  return fadedLayer(page).evaluate((layer) =>
    [...layer.querySelectorAll("[data-canvas-element]")].map((each) => each.getAttribute("data-canvas-element") ?? ""),
  )
}

test("a person fades a whole auto layout frame as one, and the export fades each of its layers @export", async ({
  page,
}, testInfo) => {
  covers("auto-layout")
  const judged = join(process.cwd(), "tests/browser", exportName)
  await rm(judged, { force: true })
  await openDeck(page, "frame.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const fills = await Promise.all(layers.map((shape) => filled(painted(page, shape))))
  await painted(page, 4).click()
  const panel = page.locator("[data-design-panel]")
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
  const opacity = panel.getByRole("textbox", { name: opacityCopy.label, exact: true })
  await expect(opacity).toHaveValue("100")
  await expect(fadedLayer(page)).toHaveCount(0)
  await opacity.fill("50")
  await opacity.press("Enter")
  await expect(fadedLayer(page)).toHaveCSS("opacity", "0.5")
  expect(await heldShapes(page)).toEqual(layers.map((shape) => `${part}#${String(shape)}`))
  expect(await Promise.all(layers.map((shape) => filled(painted(page, shape))))).toEqual(fills)
  await page.getByRole("button", { name: undoCopy.undoNamed.opacity, exact: true }).click()
  await expect(fadedLayer(page)).toHaveCount(0)
  await expect(opacity).toHaveValue("100")
  await page.getByRole("button", { name: undoCopy.redoNamed.opacity, exact: true }).click()
  await expect(fadedLayer(page)).toHaveCSS("opacity", "0.5")
  await page.reload()
  await settled(page)
  await expect(fadedLayer(page)).toHaveCSS("opacity", "0.5")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const file = testInfo.outputPath(exportName)
  await (await saving).saveAs(file)
  const original = await partsOf(join(process.cwd(), "scripts/pptx-fixtures/frame.pptx"))
  const saved = await partsOf(file)
  expect([...saved.keys()].sort()).toEqual([...original.keys()].sort())
  expect(
    [...original].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true).map(([name]) => name),
  ).toEqual([part])
  const slide = saved.get(part)?.toString("utf8") ?? ""
  for (const color of ["bg2", "accent1", "accent2"])
    expect(slide).toContain(
      `<a:solidFill><a:schemeClr val="${color}"><a:alpha val="50000"/></a:schemeClr></a:solidFill>`,
    )
  await copyFile(file, judged)
})
