import { expect, type Page } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { clickSlide, openEditor, savedNode, savedSlides } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const entry = (page: Page, number: number) => page.locator(`[data-slide-entry="${String(number)}"]`)
const onCanvas = (page: Page, part: "source" | "number") => page.locator(`[data-slide-box] [data-footer="${part}"]`)
const inThumb = (page: Page, number: number, part: "source" | "number") =>
  entry(page, number).locator(`[data-footer="${part}"]`)
const sourceField = (page: Page) => page.locator("[data-slide-source]")

test("every slide shows its source line and the page number its place gives it, on the canvas, the filmstrip and in Present", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const [cover] = await savedSlides(stack, opened)
  await expect(onCanvas(page, "number")).toHaveText("1")
  await expect(onCanvas(page, "source")).toHaveCount(0)

  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await clickSlide(page, 960, 900)
  await expect(sourceField(page)).toHaveValue("")
  await sourceField(page).fill("Source: Annual reports, 2026")
  await sourceField(page).press("Enter")
  await expect(onCanvas(page, "source")).toHaveText("Source: Annual reports, 2026")
  await expect.poll(async () => (await savedNode(stack, opened, cover!))?.source).toBe("Source: Annual reports, 2026")
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(2)

  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect(onCanvas(page, "number")).toHaveText("2")
  await expect(inThumb(page, 2, "number")).toHaveText("2")
  await expect.poll(async () => (await savedSlides(stack, opened)).length).toBe(2)
  const [, added] = await savedSlides(stack, opened)

  await entry(page, 2).dragTo(entry(page, 1))
  await expect.poll(() => savedSlides(stack, opened)).toEqual([added, cover])
  await expect(inThumb(page, 1, "number")).toHaveText("1")
  await expect(inThumb(page, 2, "number")).toHaveText("2")
  await expect(inThumb(page, 2, "source")).toHaveText("Source: Annual reports, 2026")
  await expect(inThumb(page, 1, "source")).toHaveCount(0)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => savedSlides(stack, opened)).toEqual([cover, added])
  await expect(inThumb(page, 1, "source")).toHaveText("Source: Annual reports, 2026")
  await expect(inThumb(page, 1, "number")).toHaveText("1")
  await expect(inThumb(page, 2, "number")).toHaveText("2")

  await entry(page, 1).click()
  await page.getByRole("button", { name: editorCopy.panelAgent, exact: true }).click()
  await expect(sourceField(page)).toHaveCount(0)
  const source = await onCanvas(page, "source").boundingBox()
  if (source === null) throw new Error("no source on the canvas")
  await page.mouse.dblclick(source.x + 20, source.y + source.height / 2)
  await expect(sourceField(page)).toBeFocused()
  await expect(page.locator("[data-selection-outline]")).toHaveCount(0)

  await page.getByRole("button", { name: presentCopy.present, exact: true }).click()
  const shown = page.locator("[data-present-show] [data-present-slide]")
  await expect(shown.locator('[data-footer="source"]')).toHaveText("Source: Annual reports, 2026")
  await expect(shown.locator('[data-footer="number"]')).toHaveText("1")
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-present-show]")).toHaveCount(0)
})
