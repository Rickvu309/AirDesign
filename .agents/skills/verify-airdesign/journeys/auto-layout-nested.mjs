import path from "node:path"
import { expect } from "@playwright/test"
import { groupCopy } from "../../../../apps/web/src/copy/arrange-copy.ts"
import { shortcutCopy } from "../../../../apps/web/src/copy/shortcut-copy.ts"
import { frameCopy, layoutWords } from "../../../../apps/web/src/copy/frame-copy.ts"
import { shapeCopy } from "../../../../apps/web/src/copy/shape-copy.ts"
import { transitionCopy } from "../../../../apps/web/src/copy/transition-copy.ts"

const slide = "ppt/slides/slide1.xml"
const fixture = "scripts/pptx-fixtures/blank.pptx"

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().match(/[^/]+$/)?.[0]
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const canvas = page.locator("[data-slide-paint]")
  const element = (shape) => canvas.locator(`[data-canvas-element="${slide}#${shape}"]`)
  const status = canvas.getByRole("status")
  const panel = page.locator("[data-design-panel]")
  const layers = page.locator("[data-layers-panel]")
  const chosen = () => canvas.locator("[data-selection]")
  const saved = async () => (await post(deckRoutes.open, { deck }, cookie)).json
  const last = async () => (await saved()).register.order.at(-1)
  const insert = async (name) => {
    await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await page.keyboard.press("Enter")
    await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  }
  const box = async (shape) => {
    const found = await element(shape).boundingBox()
    if (found === null) throw new Error(`no shape ${shape}`)
    return found
  }
  const center = async (shape) => {
    const found = await box(shape)
    return { x: found.x + found.width / 2, y: found.y + found.height / 2 }
  }
  const drag = async (shape, x, y) => {
    const from = await center(shape)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(x, y, { steps: 10 })
    await page.mouse.up()
  }
  const places = async (shapes) =>
    Object.fromEntries(await Promise.all(shapes.map(async (each) => [each, await box(each)])))
  const near = (left, right) =>
    Math.abs(left.x - right.x) <= 1.5 &&
    Math.abs(left.y - right.y) <= 1.5 &&
    Math.abs(left.width - right.width) <= 1.5 &&
    Math.abs(left.height - right.height) <= 1.5
  const holds = (expected) =>
    expect
      .poll(async () => {
        const now = await places(Object.keys(expected))
        return Object.keys(expected).every((shape) => near(now[shape], expected[shape]))
      })
      .toBe(true)

  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const mode = page.locator("[data-design-mode]")
  if ((await mode.getAttribute("aria-pressed")) !== "true") await mode.click()
  await expect(mode).toHaveAttribute("aria-pressed", "true")
  await insert(shapeCopy.shapes.square)
  await expect(element(4)).toBeVisible()
  await insert(shapeCopy.shapes.circle)
  await expect(element(5)).toBeVisible()
  const start = await box(4)
  await drag(4, start.x + start.width / 2, start.y - 140)
  const square = await box(4)
  await drag(5, square.x + square.width + 70, square.y + square.height / 2)
  await element(4).click()
  await element(5).click({ modifiers: [shortcutCopy.chord.other.shift] })
  await page.keyboard.press("Shift+A")
  await expect(status).toHaveText(groupCopy.said.frame)
  await expect.poll(last).toMatchObject({ slide: "element-group", backdrop: { kind: "shape" } })
  const inner = (await last()).element.node
  const id = (shape) => `${inner.split(".")[0]}.${shape}`
  await page.keyboard.press("Escape")

  await insert(shapeCopy.shapes.triangle)
  const triangle = 8
  await expect(element(triangle)).toBeVisible()
  const row = await box(4)
  await drag(triangle, row.x + row.width / 2, row.y + row.height + 110)
  await capture("frame-and-triangle")

  await element(4).click()
  await expect(chosen()).toHaveAttribute("data-selection", inner)
  await element(triangle).click({ modifiers: [shortcutCopy.chord.other.shift] })
  await expect(canvas.locator("[data-chosen]")).toHaveCount(2)
  await page.keyboard.press("Shift+A")
  await expect(status).toHaveText(groupCopy.said.frame)
  await expect.poll(last).toMatchObject({ slide: "element-group", members: [{ node: inner }, { node: id(triangle) }] })
  const outer = (await last()).element.node
  await expect(chosen()).toHaveAttribute("data-selection", outer)
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
  await expect(panel.getByRole("button", { name: layoutWords["flow.vertical"], exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  const nested = await places([4, 5, triangle])
  expect(nested[5].x).toBeGreaterThan(nested[4].x + nested[4].width - 1)
  expect(nested[triangle].y).toBeGreaterThan(nested[4].y + nested[4].height - 1)
  await capture("nested")

  await page.keyboard.press("Escape")
  await element(4).click()
  await expect(chosen()).toHaveAttribute("data-selection", outer)
  await element(4).dblclick()
  await expect(chosen()).toHaveAttribute("data-selection", inner)
  await element(4).dblclick()
  await expect(chosen()).toHaveAttribute("data-selection", id(4))
  await page.keyboard.press("Escape")
  await expect(chosen()).toHaveAttribute("data-selection", inner)
  await capture("stepped-into-inner")
  const frameRow = (node) => layers.getByRole("treeitem", { name: `Frame ${node.split(".")[1]}`, exact: true })
  const pickInner = async () => {
    await frameRow(outer).click()
    await expect(chosen()).toHaveAttribute("data-selection", outer)
    if ((await frameRow(outer).getAttribute("aria-expanded")) !== "true")
      await frameRow(outer).locator("[data-layer-caret]").click()
    await frameRow(inner).click()
  }
  await pickInner()
  const tree = await layers
    .getByRole("treeitem")
    .evaluateAll((items) =>
      items.map((item) => [
        item.getAttribute("aria-level"),
        item.getAttribute("aria-label") ?? item.textContent?.trim(),
      ]),
    )
  note(`layers with the outer frame open: ${JSON.stringify(tree)}`)
  await expect(chosen()).toHaveAttribute("data-selection", inner)
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
  await panel.getByRole("button", { name: layoutWords["flow.vertical"], exact: true }).click()
  await expect.poll(async () => (await box(5)).y).toBeGreaterThan(nested[4].y + nested[4].height - 1)
  await expect.poll(async () => (await box(triangle)).y).toBeGreaterThan((await box(5)).y + (await box(5)).height - 1)
  const column = await places([4, 5, triangle])
  expect(Math.abs(column[5].x - column[4].x)).toBeLessThanOrEqual(1.5)
  await capture("inner-made-vertical")

  await page
    .getByRole("button", { name: /^Undo / })
    .first()
    .click()
  await holds(nested)
  await capture("inner-direction-undone")
  await page
    .getByRole("button", { name: /^Redo / })
    .first()
    .click()
  await holds(column)

  await insert(shapeCopy.shapes.diamond)
  const added = 11
  await expect(element(added)).toBeVisible()
  const first = await box(4)
  const second = await box(5)
  await drag(added, first.x + first.width / 2, (first.y + first.height + second.y) / 2)
  await expect
    .poll(last)
    .toMatchObject({ slide: "element-join", frame: inner, before: id(5), member: { node: id(added) } })
  await expect.poll(async () => (await box(added)).y).toBeGreaterThan(first.y + first.height - 1)
  const joined = await places([4, added, 5, triangle])
  expect(joined[added].y).toBeGreaterThan(joined[4].y + joined[4].height - 1)
  expect(joined[5].y).toBeGreaterThan(joined[added].y + joined[added].height - 1)
  expect(joined[triangle].y).toBeGreaterThan(joined[5].y + joined[5].height - 1)
  await capture("joined-inner-frame")

  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await holds(joined)
  const downloading = page.waitForEvent("download")
  const exportName = shortcutCopy.gestures.export
  await page.getByRole("button", { name: exportName, exact: true }).click()
  await expect(page.getByRole("dialog", { name: exportName }).getByRole("button", { name: exportName })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "auto-layout-nested.pptx")
  await (await downloading).saveAs(exported)

  await page.goto(new URL(page.url()).origin)
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const reopened = page.url().match(/[^/]+$/)?.[0]
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", reopened)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  if ((await mode.getAttribute("aria-pressed")) !== "true") await mode.click()
  await holds(joined)
  await element(4).click()
  await expect(chosen()).toHaveAttribute("data-selection", outer)
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
  await pickInner()
  await expect(chosen()).toHaveAttribute("data-selection", inner)
  await expect(panel.getByText(frameCopy.autoFrame, { exact: true })).toBeVisible()
  await expect(panel.getByRole("button", { name: layoutWords["flow.vertical"], exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await capture("reimported")

  note(
    `A square and a circle became an auto layout frame (${inner}) with Shift+A. That frame and a triangle under it, chosen with Shift+click, became a second auto layout frame (${outer}) with Shift+A: a column holding the row and the triangle, the panel reading Auto layout frame with Direction Vertical. A click on the square picked the outer frame, a double-click the inner frame, another the square, and Escape the inner frame again. The inner frame, picked in the layers panel, turned to a column with Direction Vertical; the circle went under the square and the triangle moved down with it, and Undo and Redo moved them back and forth. A diamond dragged between the square and the circle joined the inner frame there (an element-join into ${inner} before the circle), pushing the circle and the triangle down. A reload kept every place, and the export ${path.basename(exported)} re-imported with both frames read back as auto layout frames, the inner one still a column, every shape where it was.`,
  )
}
