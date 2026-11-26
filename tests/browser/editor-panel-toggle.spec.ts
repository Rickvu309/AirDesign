import { expect, type Page } from "@playwright/test"
import * as doom from "../../packages/doom/src/index.ts"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { airaCopy } from "../../apps/web/src/copy/aira-copy"
import { exportCopy } from "../../apps/web/src/copy/export-copy"
import { zoomCopy, zoomToOf } from "../../apps/web/src/copy/product-copy"
import { test } from "./api-stack"
import { clickSlide, openEditor, selectedIds } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const toggle = (page: Page) => page.getByRole("button", { name: editorCopy.sidePanel, exact: true })
const panel = (page: Page) => page.locator("[data-editor-panel]")
const canvasWidth = async (page: Page) => (await page.locator("[data-editor-canvas]").boundingBox())?.width ?? 0
const panelWidth = async (page: Page) => (await panel(page).boundingBox())?.width ?? 0

test("the side panel button closes and opens the panel under one pointer spot, and each view remembers its own state", async ({
  page,
  context,
  stack,
}) => {
  const faults: string[] = []
  page.on("pageerror", (error) => faults.push(error.message))
  await openEditor(page, context, stack)
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true")
  await expect(panel(page)).toBeVisible()
  const narrow = await canvasWidth(page)

  await page.getByRole("separator", { name: designCopy.resizePanel }).focus()
  await page.keyboard.press("ArrowLeft")
  await page.keyboard.press("ArrowLeft")
  const resized = await panelWidth(page)

  const spot = await toggle(page).boundingBox()
  const x = (spot?.x ?? 0) + (spot?.width ?? 0) / 2
  const y = (spot?.y ?? 0) + (spot?.height ?? 0) / 2
  await page.mouse.click(x, y)
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false")
  await expect(panel(page)).toBeHidden()
  expect(await canvasWidth(page)).toBeGreaterThan(narrow)
  await expect(page.getByRole("button", { name: presentCopy.present, exact: true })).toHaveCount(1)
  await page.mouse.click(x, y)
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true")
  expect(await panelWidth(page)).toBe(resized)

  await toggle(page).focus()
  await page.keyboard.press("Space")
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false")
  await expect(toggle(page)).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true")
  await expect(toggle(page)).toBeFocused()

  await toggle(page).click()
  const design = page.getByRole("button", { name: editorCopy.panelDesign, exact: true })
  await design.click()
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true")
  await expect(design).toHaveAttribute("aria-pressed", "true")
  await design.click()
  await expect(panel(page)).toBeVisible()

  await toggle(page).click()
  await page.reload()
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false")
  await expect(panel(page)).toBeHidden()

  await page.getByRole("button", { name: slideListCopy.gridView }).click()
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false")
  await toggle(page).click()
  await expect(panel(page)).toBeVisible()
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
  await page.getByRole("button", { name: slideListCopy.slidesView }).click()
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false")
  await page.getByRole("button", { name: slideListCopy.gridView }).click()
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true")
  expect(faults).toEqual([])
})

test("with the panel closed the selection, zoom, Present, Export and a running Aira all keep working", async ({
  page,
  context,
  stack,
}) => {
  const faults: string[] = []
  page.on("pageerror", (error) => faults.push(error.message))
  const opened = await openEditor(page, context, stack)
  const slide = page.locator("[data-slide-box]")

  await clickSlide(page, 300, 490)
  const picked = await selectedIds(page)
  expect(picked.length).toBe(1)
  await toggle(page).click()
  await expect(panel(page)).toBeHidden()
  expect(await selectedIds(page)).toEqual(picked)
  await page.keyboard.press("Escape")

  const fitted = Math.round((await slide.boundingBox())?.width ?? 0)
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemradio", { name: zoomToOf(100) }).click()
  await expect.poll(async () => Math.round((await slide.boundingBox())?.width ?? 0)).toBe(1920)
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemradio", { name: zoomCopy.fit }).click()
  await expect.poll(async () => Math.round((await slide.boundingBox())?.width ?? 0)).toBe(fitted)

  const present = page.getByRole("button", { name: presentCopy.present, exact: true })
  await present.click()
  await expect(page.locator("[data-present-show] [data-present-slide]")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-present-show]")).toHaveCount(0)
  await expect(present).toBeFocused()
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false")

  await page.getByRole("button", { name: exportCopy.title, exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)

  await toggle(page).click()
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const base = doom.readFold(answer.json.fold)?.rev
  stack.aira(
    { name: "add-kpi.sse", fill: { deck: opened.deck, base: String(base), slide: opened.slide } },
    { name: "added-kpi.sse" },
  )
  await panel(page).getByRole("textbox", { name: airaCopy.askAira }).fill("Add three KPIs to this slide")
  await page.keyboard.press("Enter")
  await toggle(page).click()
  await expect(panel(page)).toBeHidden()
  await expect(slide.getByText("$4.2M", { exact: true })).toBeVisible()
  await expect(page.locator("[data-panel-working]")).toHaveCount(0)
  await toggle(page).click()
  await expect(
    panel(page).getByText("The slide now shows revenue, customers and churn.", { exact: true }),
  ).toBeVisible()

  expect(faults).toEqual([])
})

test("at the smallest window the app lays out for, the closed panel's bar stays inside the window and clear of the sidebar and the grid's head", async ({
  page,
  context,
  stack,
}) => {
  await openEditor(page, context, stack)
  await toggle(page).click()
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 720 })
    const bar = await toggle(page).boundingBox()
    const side = await page.locator("[data-editor-sidebar]").boundingBox()
    const exported = await page.getByRole("button", { name: exportCopy.title, exact: true }).boundingBox()
    expect(bar?.x ?? 0).toBeGreaterThan((side?.x ?? 0) + (side?.width ?? 0))
    expect((exported?.x ?? 0) + (exported?.width ?? 0)).toBeLessThanOrEqual(width)
  }
  await page.getByRole("button", { name: slideListCopy.gridView }).click()
  const head = await page.getByRole("button", { name: slideListCopy.slidesView }).boundingBox()
  const zoom = await page.locator("[data-zoom-readout]").boundingBox()
  expect((head?.x ?? 0) + (head?.width ?? 0)).toBeLessThan(zoom?.x ?? 0)
})
