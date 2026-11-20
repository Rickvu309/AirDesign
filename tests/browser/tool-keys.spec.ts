import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { opacityCopy } from "../../apps/web/src/copy/opacity-copy"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { exportCopy } from "../../apps/web/src/export/export-options"
import { openDeck } from "./design-panel"
import { covers } from "./gesture"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("T, R, O, L, Shift+L and Shift+Ctrl+K add a text box, shapes and an image from the slide, and not from a button", async ({
  page,
}) => {
  covers("tool-text", "tool-rectangle", "tool-ellipse", "tool-line", "tool-arrow", "place-image")
  await openDeck(page, "clean.pptx")
  const slide = page.locator("[data-slide-paint]")
  const layers = slide.locator("[data-canvas-element]")
  const initial = await layers.count()
  await page.getByRole("button", { name: presentCopy.present, exact: true }).focus()
  await page.keyboard.press("r")
  await page.keyboard.press("t")
  await slide.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("t")
  await expect(slide.locator('[contenteditable="true"]:focus')).toHaveCount(1)
  expect(await layers.count()).toBe(initial + 1)
  for (const [step, key] of ["r", "o", "l", "Shift+L"].entries()) {
    await slide.click({ position: { x: 4, y: 4 } })
    await page.keyboard.press(key)
    await expect(layers).toHaveCount(initial + step + 2)
  }
  const browser = await page.context().newCDPSession(page)
  await browser.send("Page.enable")
  const chooser = new Promise<number | undefined>((opened) => {
    browser.once("Page.fileChooserOpened", ({ backendNodeId }) => opened(backendNodeId))
  })
  await browser.send("Page.setInterceptFileChooserDialog", { enabled: true })
  await slide.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("ControlOrMeta+Shift+K")
  const backendNodeId = await chooser
  expect(backendNodeId).toBeDefined()
  await browser.send("DOM.setFileInputFiles", {
    backendNodeId,
    files: [join(process.cwd(), "scripts/pptx-fixtures/picture.png")],
  })
  await browser.detach()
  await expect(layers).toHaveCount(initial + 6)
})

test("Alt+1 opens the layers in design mode, and Shift+Ctrl+E opens Export", async ({ page }) => {
  covers("layers-panel", "export")
  await openDeck(page, "clean.pptx")
  const mode = page.getByRole("button", { name: designCopy.designMode, exact: true })
  await page.locator("[data-slide-paint]").click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("Alt+Digit1")
  await expect(mode).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("[data-layers-panel]")).toBeVisible()
  await page.keyboard.press("ControlOrMeta+Shift+KeyE")
  await expect(page.getByRole("dialog", { name: exportCopy.title })).toBeVisible()
})

test("a digit sets the selected layer's opacity in tens, and two quick digits set it exactly", async ({ page }) => {
  covers("opacity")
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]').click()
  const field = page.locator("[data-design-element]").getByRole("textbox", { name: opacityCopy.label, exact: true })
  await expect(field).toHaveValue(/^100/)
  await page.keyboard.press("2")
  await page.keyboard.press("5")
  await expect(field).toHaveValue(/^25/)
  await page.keyboard.press("0")
  await page.keyboard.press("0")
  await expect(field).toHaveValue(/^0/)
  await page.keyboard.press("7")
  await expect(field).toHaveValue(/^70/)
})
