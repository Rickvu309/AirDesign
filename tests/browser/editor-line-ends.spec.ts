import { scriptOf } from "../../packages/agent/src/testing/change-script.ts"
import { expect, type Page } from "@playwright/test"
import { borderWords } from "../../apps/web/src/copy/border-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { forward, test } from "./api-stack"
import { dragTo, gripCentre, lineFrom, paintedStart, type Point } from "./editor-line-end"
import { covers } from "./gesture"
import { accent, clickSlide, landNodes, openEditor, savedNode, slidePoint, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Line = { start: unknown; end: unknown; route: string }

test("a line's end drags onto a shape's side and stays there, frees again, and the panel changes its route", async ({
  page,
  context,
  stack,
}) => {
  covers("line-end")
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(1000, 500, 300, 200), fills: accent } },
    {
      id: "t:2",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(200, 300, 400, 0),
        strokes: accent,
        stroke: { weight: 4, align: "center", dash: "solid" },
        geometry: {
          kind: "line",
          start: { x: 200, y: 300 },
          end: { x: 600, y: 300 },
          route: "straight",
          arrows: ["none", "arrow"],
        },
      },
    },
  ])
  const line = async () => (await savedNode(stack, opened, "t:2"))?.geometry as Line
  await clickSlide(page, 400, 300)
  await expect(page.locator('[data-grip="line-end"]')).toBeVisible()

  await dragTo(page, await gripCentre(page, "line-end"), await slidePoint(page, 1004, 602))
  await expect.poll(async () => (await line()).end).toEqual({ node: "t:1", site: "l" })
  await expect(page.locator('[data-line-end="attached"]')).toHaveCount(1)

  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  const border = page.locator(`[data-design-panel] [data-design-section="${designCopy.border}"]`)
  await border.getByRole("button", { name: borderWords["route.elbow"]!, exact: true }).click()
  await expect.poll(async () => (await line()).route).toBe("elbow")

  await dragTo(page, await gripCentre(page, "line-end"), await slidePoint(page, 700, 150))
  await expect.poll(async () => (await line()).end).toEqual({ x: 700, y: 150 })

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await line()).end).toEqual({ node: "t:1", site: "l" })
})

test("deleting a shape frees the connector at the point it last painted", async ({ page, context, stack }) => {
  covers("delete")
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: { box: spot(400, 200, 200, 100), fills: accent, geometry: { kind: "rect" } },
    },
    {
      id: "t:2",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(100, 250, 300, 0),
        strokes: accent,
        stroke: { weight: 4, align: "center", dash: "solid" },
        geometry: {
          kind: "line",
          start: { x: 100, y: 250 },
          end: { node: "t:1", site: "l" },
          route: "straight",
          arrows: ["none", "none"],
        },
      },
    },
  ])
  const line = async () => (await savedNode(stack, opened, "t:2"))?.geometry as Line
  await clickSlide(page, 500, 250)
  await page.keyboard.press("Delete")
  await expect.poll(async () => (await savedNode(stack, opened, "t:1"))?.parent ?? null).toBeNull()
  await expect.poll(async () => (await line()).end).toEqual({ x: 400, y: 250 })
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await line()).end).toEqual({ node: "t:1", site: "l" })
})

const wiredTo = (target: string) => ({
  box: spot(100, 250, 300, 0),
  strokes: accent,
  stroke: { weight: 4, align: "center", dash: "solid" },
  geometry: {
    kind: "line",
    start: { x: 100, y: 250 },
    end: { node: target, site: "l" },
    route: "straight",
    arrows: ["none", "none"],
  },
})

test("ungrouping a frame frees the connector at the point it last painted and keeps the children", async ({
  page,
  context,
  stack,
}) => {
  covers("ungroup")
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "frame",
      parent: opened.slide,
      props: { box: spot(400, 200, 300, 100), fills: accent },
    },
    { id: "t:3", type: "shape", parent: "t:1", props: { box: spot(10, 10, 60, 40), fills: accent } },
    { id: "t:2", type: "shape", parent: opened.slide, props: wiredTo("t:1") },
  ])
  const line = async () => (await savedNode(stack, opened, "t:2"))?.geometry as Line
  await clickSlide(page, 650, 280)
  await page.keyboard.press("ControlOrMeta+Shift+g")
  await expect.poll(async () => (await savedNode(stack, opened, "t:1"))?.parent ?? null).toBeNull()
  await expect.poll(async () => (await line()).end).toEqual({ x: 400, y: 250 })
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await line()).end).toEqual({ node: "t:1", site: "l" })
})

test("emptying a text frees the connector at the left edge it painted", async ({ page, context, stack }) => {
  covers("edit-text")
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(400, 200, 300, 60),
        text: { chars: "Hello", spans: [], paras: [{}], style: "body", resize: "height", alignV: "top" },
      },
    },
    { id: "t:2", type: "shape", parent: opened.slide, props: wiredTo("t:1") },
  ])
  const line = async () => (await savedNode(stack, opened, "t:2"))?.geometry as Line
  await clickSlide(page, 420, 220)
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await page.keyboard.press("Backspace")
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await savedNode(stack, opened, "t:1"))?.parent ?? null).toBeNull()
  await expect.poll(async () => (await line()).end).toMatchObject({ x: 400 })
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await line()).end).toEqual({ node: "t:1", site: "l" })
})

const hugging = (slide: string) => [
  {
    id: "f:1",
    type: "frame" as const,
    parent: slide,
    props: {
      box: spot(100, 150, 1, 1),
      layout: { mode: "row", gap: 10, padding: { t: 20, r: 20, b: 20, l: 20 }, align: "top-left" },
      sizing: { w: "hug", h: "hug" },
    },
  },
  {
    id: "w:1",
    type: "shape" as const,
    parent: "f:1",
    props: {
      box: spot(0, 0, 200, 100),
      sizing: { w: "hug", h: "hug" },
      text: {
        chars: "Hello world hello WWW",
        spans: [],
        paras: [{}],
        style: "body",
        resize: "widthAndHeight",
        alignV: "top",
      },
    },
  },
  { id: "t:1", type: "shape" as const, parent: "f:1", props: { box: spot(0, 0, 140, 80), fills: accent } },
]

test("an agent's unwrap frees the connector where the canvas painted it", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [...hugging(opened.slide), lineFrom(opened.slide, { node: "f:1", site: "r" })])
  await expect(page.locator('[data-slide-box] [data-node="l:1"]')).toBeVisible()
  await expect(page.locator("[data-slide-box] [data-fonts-pending]")).toHaveCount(0)
  const seen = await paintedStart(page, "l:1")
  await stack.toolBlocks(
    "airdesign_execute",
    { deck: opened.deck, script: scriptOf([{ op: "unwrap", node: "f:1" }]) },
    opened.cookie,
  )
  await expect(page.locator('[data-slide-box] [data-node="f:1"]')).toHaveCount(0)
  const freed = (await savedNode(stack, opened, "l:1"))?.geometry as { start: Point }
  expect(Math.abs(freed.start.x - seen.x)).toBeLessThanOrEqual(1)
  expect(Math.abs((await paintedStart(page, "l:1")).x - seen.x)).toBeLessThanOrEqual(1)
})

test("an emptied text's connector stays where it painted while typing and after leaving", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text")
  const opened = await openEditor(page, context, stack)
  const [, words] = hugging(opened.slide)
  await landNodes(stack, opened, [
    { ...words!, parent: opened.slide, props: { ...words!.props, box: spot(300, 250, 500, 80) } },
    lineFrom(opened.slide, { node: "w:1", site: "r" }),
  ])
  await expect(page.locator('[data-slide-box] [data-node="l:1"]')).toBeVisible()
  await expect(page.locator("[data-slide-box] [data-fonts-pending]")).toHaveCount(0)
  const seen = await paintedStart(page, "l:1")
  await clickSlide(page, 350, 275)
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Backspace")
  await expect.poll(() => paintedStart(page, "l:1")).toEqual(seen)
  await page.keyboard.press("Escape")
  await expect(page.locator('[data-slide-box] [data-node="w:1"]')).toHaveCount(0)
  expect(await paintedStart(page, "l:1")).toEqual(seen)
})

test("a tab that still saw the attachment moves the line, and the end the other tab freed stays; undo attaches it again", async ({
  page,
  context,
  stack,
}) => {
  covers("delete")
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(400, 200, 200, 100), fills: accent } },
    lineFrom(opened.slide, { node: "t:1", site: "l" }, { x: 100, y: 350 }),
  ])
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const cut: readonly string[] = [doomRoutes.since.path, doomRoutes.edit.path]
  const second = await context.newPage()
  await forward(second, stack)
  let apart = true
  await second.route(
    (url) => cut.includes(url.pathname),
    (route) => (apart ? route.abort("internetdisconnected") : route.fallback()),
  )
  await second.goto(page.url())
  await expect(second.locator('[data-slide-box] [data-node="l:1"]')).toBeVisible()
  const geometry = async () => (await savedNode(stack, opened, "l:1"))?.geometry as Line
  await clickSlide(page, 505, 250)
  await page.keyboard.press("Delete")
  await expect.poll(async () => (await geometry()).start).toEqual({ x: 400, y: 250 })
  await clickSlide(second, 250, 300)
  await second.keyboard.press("ArrowDown")
  apart = false
  await expect.poll(async () => (await geometry()).end).toEqual({ x: 100, y: 351 })
  expect((await geometry()).start).toEqual({ x: 400, y: 250 })
  for (const tab of [page, second]) await expect.poll(() => paintedStart(tab, "l:1")).toEqual({ x: 400, y: 250 })
  await page.bringToFront()
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await geometry()).start).toEqual({ node: "t:1", site: "l" })
  expect((await geometry()).end).toEqual({ x: 100, y: 351 })
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(async () => (await geometry()).start).toEqual({ x: 400, y: 250 })
})

test("emptying a draft that already reflowed keeps the connector where the draft painted it", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text")
  const opened = await openEditor(page, context, stack)
  const [, words] = hugging(opened.slide)
  await landNodes(stack, opened, [
    { ...words!, parent: opened.slide, props: { ...words!.props, box: spot(300, 250, 500, 80) } },
    lineFrom(opened.slide, { node: "w:1", site: "r" }),
  ])
  await expect(page.locator('[data-slide-box] [data-node="l:1"]')).toBeVisible()
  await expect(page.locator("[data-slide-box] [data-fonts-pending]")).toHaveCount(0)
  const saved = await paintedStart(page, "l:1")
  await clickSlide(page, 350, 275)
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  const painted = () =>
    page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type("7")
  await painted()
  const seen = await paintedStart(page, "l:1")
  expect(seen.x).toBeLessThan(saved.x - 20)
  await page.keyboard.press("Backspace")
  await painted()
  expect(await paintedStart(page, "l:1")).toEqual(seen)
  await page.keyboard.press("Escape")
  await expect(page.locator('[data-slide-box] [data-node="w:1"]')).toHaveCount(0)
  expect(await paintedStart(page, "l:1")).toEqual(seen)
  await expect.poll(async () => (await savedNode(stack, opened, "w:1"))?.parent ?? null).toBeNull()
  const freed = (await savedNode(stack, opened, "l:1"))?.geometry as { start: Point }
  expect(Math.abs(freed.start.x - seen.x)).toBeLessThanOrEqual(1)
})

test("emptying a draft beside the connector's frame in an auto layout row keeps the connector still", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text")
  const opened = await openEditor(page, context, stack)
  const [row, words] = hugging(opened.slide)
  await landNodes(stack, opened, [
    {
      ...row!,
      props: {
        ...row!.props,
        layout: { mode: "row", gap: 100, padding: { t: 20, r: 20, b: 20, l: 20 }, align: "top-left" },
      },
    },
    words!,
    { id: "g:1", type: "frame", parent: "f:1", props: { box: spot(0, 0, 200, 100), fills: accent } },
    lineFrom("g:1", { node: "w:1", site: "r" }, { x: 100, y: 50 }),
  ])
  await expect(page.locator('[data-slide-box] [data-node="l:1"]')).toBeVisible()
  await expect(page.locator("[data-slide-box] [data-fonts-pending]")).toHaveCount(0)
  const start = () =>
    page.locator('[data-slide-box] [data-node="l:1"]').evaluate((element) => {
      const path = element.querySelector("path")
      const canvas = element.closest("[data-slide-box]")
      const matrix = path?.getScreenCTM()
      if (path == null || matrix == null || canvas == null) throw new Error("no line path")
      const screen = path.getPointAtLength(0).matrixTransform(matrix)
      const box = canvas.getBoundingClientRect()
      const scale = box.width / 1920
      return { x: (screen.x - box.x) / scale, y: (screen.y - box.y) / scale }
    })
  const near = (one: Point, other: Point) => Math.hypot(one.x - other.x, one.y - other.y) <= 0.5
  const saved = await start()
  await page.keyboard.down("Control")
  await clickSlide(page, 145, 192)
  await page.keyboard.up("Control")
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-text-editor]")).toBeFocused()
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 100))
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.insertText("Wi")
  await expect.poll(async () => (await start()).x).toBeLessThan(saved.x - 100)
  const seen = await start()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Backspace")
  await expect.poll(async () => (await page.locator("[data-text-editor]").textContent())?.trim()).toBe("")
  expect(near(await start(), seen)).toBe(true)
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await savedNode(stack, opened, "w:1"))?.parent).toBeNull()
  expect(near(await start(), seen)).toBe(true)
})

test("an undo that brings back a frame after another tab deleted the connector's shape frees the end where it last painted", async ({
  page,
  context,
  stack,
}) => {
  covers("delete", "undo")
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "f:1", type: "frame", parent: opened.slide, props: { box: spot(100, 100, 170, 160), fills: accent } },
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(400, 200, 200, 100), fills: accent } },
    {
      id: "l:1",
      type: "shape",
      parent: "f:1",
      props: {
        box: spot(0, 0, 10, 10),
        strokes: accent,
        stroke: { weight: 4, align: "center", dash: "solid" },
        geometry: {
          kind: "line",
          start: { node: "t:1", site: "r" },
          end: { x: 15, y: 120 },
          route: "straight",
          arrows: ["none", "none"],
        },
      },
    },
  ])
  const painted = (tab: Page, id: string) => tab.locator(`[data-slide-box] [data-node="${id}"]`)
  const other = await context.newPage()
  await forward(other, stack)
  await other.goto(page.url())
  await other.locator("[data-editor-ready]").waitFor()
  await page.bringToFront()
  await clickSlide(page, 120, 120)
  await page.keyboard.press("Delete")
  await expect.poll(async () => (await savedNode(stack, opened, "f:1"))?.parent).toBeNull()
  await expect(painted(other, "f:1")).toHaveCount(0)
  await other.bringToFront()
  await clickSlide(other, 500, 250)
  await other.keyboard.press("Delete")
  await expect.poll(async () => (await savedNode(stack, opened, "t:1"))?.parent).toBeNull()
  await expect(painted(page, "t:1")).toHaveCount(0)
  await page.bringToFront()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(painted(page, "l:1")).toBeVisible()
  await expect.poll(async () => (await savedNode(stack, opened, "f:1"))?.parent).toMatchObject({ id: opened.slide })
  await expect
    .poll(async () => ((await savedNode(stack, opened, "l:1"))?.geometry as Line | undefined)?.start)
    .toEqual({ x: 500, y: 150 })
  await page.reload()
  await expect(painted(page, "l:1")).toBeVisible()
  expect(((await savedNode(stack, opened, "l:1"))?.geometry as Line).start).toEqual({ x: 500, y: 150 })
})
