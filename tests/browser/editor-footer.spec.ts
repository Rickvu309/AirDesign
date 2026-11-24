import { expect, type Page } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { exportCopy } from "../../apps/web/src/copy/export-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { accent, clickSlide, landNodes, openEditor, savedNode, savedSlides, spot } from "./editor-deck"

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

const citation =
  "SOURCE: COMPANY ANNUAL REPORTS AND REGULATORY FILINGS, 2021 TO 2026; INVESTOR PRESENTATIONS; LICENSED MARKET DATA; INDUSTRY ASSOCIATION SURVEYS; EXPERT INTERVIEWS; TEAM ANALYSIS OF PUBLIC AND LICENSED DATA SOURCES ACROSS THE UNITED STATES, EUROPE AND ASIA, AS REPORTED BY THE COMPANIES"

const linesOf = (page: Page, locator: string) =>
  page.evaluate((selector) => {
    const element = document.querySelector(selector)
    if (element === null) return -1
    const range = document.createRange()
    range.selectNodeContents(element)
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
  }, locator)

test("a long source wraps to two lines inside the footer band and ends in an ellipsis, the same on the canvas, the filmstrip and the print sheet, with every word kept in the field", async ({
  page,
  context,
  stack,
}) => {
  await page.addInitScript(() => {
    window.print = () => undefined
  })
  const opened = await openEditor(page, context, stack)
  const [cover] = await savedSlides(stack, opened)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await clickSlide(page, 960, 900)
  await sourceField(page).fill(citation)
  await sourceField(page).press("Enter")
  await expect.poll(async () => (await savedNode(stack, opened, cover!))?.source).toBe(citation)

  const source = onCanvas(page, "source")
  await expect(source).toContainText("…")
  const shown = (await source.textContent()) ?? ""
  expect(shown.endsWith("…")).toBe(true)
  expect(citation.replace(/\s/g, "").startsWith(shown.slice(0, -1).replace(/\s/g, ""))).toBe(true)
  expect(await linesOf(page, '[data-slide-box] [data-footer="source"]')).toBe(2)
  const slide = (await page.locator("[data-slide-box]").boundingBox())!
  const box = (await source.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(slide.y + slide.height * (1000 / 1080))
  expect(box.y + box.height).toBeLessThanOrEqual(slide.y + slide.height)
  await expect(sourceField(page)).toHaveValue(citation)
  await expect(inThumb(page, 1, "source")).toHaveText(shown)

  await page.getByRole("button", { name: productCopy.exportDeck, exact: true }).click()
  await page.getByRole("dialog", { name: exportCopy.title }).getByRole("button", { name: exportCopy.action }).click()
  const printed = page.locator('[data-print-sheet] [data-print-page] [data-footer="source"]')
  await expect(printed).toHaveText(shown)
  expect(await linesOf(page, '[data-print-sheet] [data-print-page] [data-footer="source"]')).toBe(2)
})

test("a double-click on the source words opens the Source field even when a layer covers the band, and a double-click on the band beside them does not", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const [cover] = await savedSlides(stack, opened)
  await landNodes(stack, opened, [
    { id: "t:7", type: "shape", parent: opened.slide, props: { box: spot(0, 980, 1920, 100), fills: accent } },
  ])
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await clickSlide(page, 960, 900)
  await sourceField(page).fill("Source: Team analysis")
  await sourceField(page).press("Enter")
  await expect.poll(async () => (await savedNode(stack, opened, cover!))?.source).toBe("Source: Team analysis")
  await page.getByRole("button", { name: editorCopy.panelAgent, exact: true }).click()

  const source = (await onCanvas(page, "source").boundingBox())!
  await page.mouse.dblclick(source.x + 20, source.y + source.height / 2)
  await expect(sourceField(page)).toBeFocused()
  await expect(page.locator("[data-selection-outline]")).toHaveCount(0)
  await expect(page.locator("[data-text-editor]")).toHaveCount(0)

  await sourceField(page).press("Escape")
  await expect(sourceField(page)).not.toBeFocused()
  await clickSlide(page, 1500, 1040, { double: true })
  await expect(page.locator("[data-slide-source]:focus")).toHaveCount(0)
})

test("a double-click on the source asks for the Source field once: clearing a layer selection later leaves focus where it is, and Escape in the field returns to the canvas", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const [cover] = await savedSlides(stack, opened)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await clickSlide(page, 960, 900)
  await sourceField(page).fill("Source: Team analysis")
  await sourceField(page).press("Enter")
  await expect.poll(async () => (await savedNode(stack, opened, cover!))?.source).toBe("Source: Team analysis")

  const source = (await onCanvas(page, "source").boundingBox())!
  await page.mouse.dblclick(source.x + 20, source.y + source.height / 2)
  await expect(sourceField(page)).toBeFocused()
  await sourceField(page).press("Escape")
  await expect(page.locator("[data-canvas-stage]")).toBeFocused()

  await clickSlide(page, 600, 410)
  await expect(sourceField(page)).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(sourceField(page)).toHaveValue("Source: Team analysis")
  await expect(sourceField(page)).not.toBeFocused()
  await page.keyboard.press("Delete")
  await page.keyboard.press("Enter")
  await expect(onCanvas(page, "source")).toHaveText("Source: Team analysis")
  expect((await savedNode(stack, opened, cover!))?.source).toBe("Source: Team analysis")
})
