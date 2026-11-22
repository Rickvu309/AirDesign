import { expect, type Page } from "@playwright/test"
import { shapeFill } from "../../apps/web/src/editor/tool-panels-art"
import { sceneEditorCopy } from "../../apps/web/src/copy/scene-editor-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, dragSlide, openSceneEditor, savedNode, selectedIds, type Opened } from "./scene-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Stack = Parameters<typeof savedNode>[0]
type Saved = Record<string, unknown> & {
  box: { x: number; y: number; w: number; h: number }
  geometry: { kind: string; arrows?: string[] }
}

const picked = async (page: Page, stack: Stack, opened: Opened) => {
  const [id] = await selectedIds(page)
  if (id === undefined || id === null) return { id: "", node: undefined }
  return { id, node: (await savedNode(stack, opened, id)) as Saved | undefined }
}

const near = (value: number | undefined, goal: number | undefined, slack = 3) =>
  Math.abs((value ?? 0) - (goal ?? 0)) <= slack

test("R draws a rectangle where it is dragged, Shift keeps it square, and the tool goes back to Move", async ({
  page,
  context,
  stack,
}) => {
  covers("tool-rectangle", "tool-ellipse", "undo")
  const opened = await openSceneEditor(page, context, stack)
  await page.keyboard.press("r")
  await dragSlide(page, { x: 300, y: 640 }, { x: 700, y: 900 })
  await expect(page.getByRole("button", { name: sceneEditorCopy.toolMove, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect.poll(async () => (await picked(page, stack, opened)).node?.geometry.kind).toBe("rect")
  const made = (await picked(page, stack, opened)).node!
  expect(near(made.box.x, 300) && near(made.box.y, 640) && near(made.box.w, 400) && near(made.box.h, 260)).toBe(true)
  expect(made.fills).toEqual([{ kind: "solid", color: shapeFill.toLowerCase() }])

  await page.keyboard.press("o")
  await page.keyboard.down(shortcutCopy.chord.other.shift)
  await dragSlide(page, { x: 900, y: 640 }, { x: 1200, y: 760 })
  await page.keyboard.up(shortcutCopy.chord.other.shift)
  await expect.poll(async () => (await picked(page, stack, opened)).node?.geometry.kind).toBe("ellipse")
  const round = (await picked(page, stack, opened)).node!
  expect(near(round.box.w, round.box.h, 2)).toBe(true)

  const before = await page.locator("[data-slide-box] [data-node]").count()
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => page.locator("[data-slide-box] [data-node]").count()).toBe(before - 1)
})

test("a click places a default size, F draws a frame that holds what is drawn inside it, and L and Shift+L draw lines", async ({
  page,
  context,
  stack,
}) => {
  covers("tool-frame", "tool-line", "tool-arrow")
  const opened = await openSceneEditor(page, context, stack)
  await page.keyboard.press("f")
  await dragSlide(page, { x: 200, y: 560 }, { x: 1000, y: 1000 })
  const frame = await picked(page, stack, opened)
  await expect.poll(async () => (await picked(page, stack, opened)).node?.clip).toBe(true)
  await page.keyboard.press("r")
  await clickSlide(page, 300, 640)
  await expect.poll(async () => (await picked(page, stack, opened)).node?.geometry.kind).toBe("rect")
  const inside = await picked(page, stack, opened)
  expect(near(inside.node?.box.w, 100) && near(inside.node?.box.h, 100)).toBe(true)
  const holder = inside.node?.parent as { id: string } | undefined
  expect(holder?.id).toBe(frame.id)
  expect(near(inside.node?.box.x, 100)).toBe(true)

  await page.keyboard.press("l")
  await dragSlide(page, { x: 1200, y: 300 }, { x: 1600, y: 300 })
  await expect.poll(async () => (await picked(page, stack, opened)).node?.geometry.kind).toBe("line")
  expect((await picked(page, stack, opened)).node?.geometry.arrows).toEqual(["none", "none"])
  await page.keyboard.press("Shift+L")
  await dragSlide(page, { x: 1200, y: 400 }, { x: 1600, y: 500 })
  await expect.poll(async () => (await picked(page, stack, opened)).node?.geometry.arrows).toEqual(["none", "arrow"])
})

test("Actions, centred over the toolbar, adds an icon from a search and each kind of chart with sample data", async ({
  page,
  context,
  stack,
}) => {
  covers("actions")
  const opened = await openSceneEditor(page, context, stack)
  await page.keyboard.press("ControlOrMeta+k")
  const panel = page.locator("[data-actions-panel]")
  await expect(panel).toBeVisible()
  const bar = await page.getByRole("toolbar", { name: sceneEditorCopy.tools }).boundingBox()
  const open = await page.locator('[data-slot="popover-content"]').boundingBox()
  expect(near((open?.x ?? 0) + (open?.width ?? 0) / 2, (bar?.x ?? 0) + (bar?.width ?? 0) / 2, 3)).toBe(true)
  expect(near((bar?.y ?? 0) - ((open?.y ?? 0) + (open?.height ?? 0)), 12, 3)).toBe(true)

  const search = page.getByRole("searchbox", { name: sceneEditorCopy.actionsSearch })
  await expect(search).toBeFocused()
  await expect(search).toHaveCSS("outline-style", "none")
  await search.fill("rocket")
  await page.getByRole("button", { name: "rocket", exact: true }).click()
  await expect.poll(async () => (await picked(page, stack, opened)).node?.geometry.kind).toBe("icon")
  const icon = (await picked(page, stack, opened)).node!
  expect(icon.geometry).toMatchObject({ name: "lucide/rocket" })
  expect(near(icon.box.x, 900, 1) && near(icon.box.y, 480, 1)).toBe(true)

  for (const kind of ["column", "bar", "line", "pie", "stacked"] as const) {
    await page.getByRole("button", { name: sceneEditorCopy.actions, exact: true }).click()
    await page.getByRole("button", { name: sceneEditorCopy.chartKinds[kind], exact: true }).click()
    await expect.poll(async () => (await picked(page, stack, opened)).node?.chart).toMatchObject({ kind })
  }
  await expect.poll(() => page.locator("[data-slide-box] [data-derived]").count()).toBeGreaterThan(4)
})

test("the Move menu is dark, lined up with its chevron, and marks the tool in use", async ({
  page,
  context,
  stack,
}) => {
  covers("tool-hand")
  await openSceneEditor(page, context, stack)
  const chevron = page.getByRole("button", { name: sceneEditorCopy.moveTools })
  await chevron.click()
  const menu = page.getByRole("menu")
  await expect(menu).toBeVisible()
  const edge = await chevron.boundingBox()
  const box = await menu.boundingBox()
  expect(near(box?.x, edge?.x, 2)).toBe(true)
  await expect(menu).toHaveCSS("background-color", "rgb(30, 30, 30)")
  await expect(menu.getByRole("menuitem", { name: new RegExp(sceneEditorCopy.toolMove) })).toHaveAttribute(
    "aria-current",
    "true",
  )
  await menu.getByRole("menuitem", { name: new RegExp(sceneEditorCopy.toolHand) }).click()
  await expect(page.getByRole("button", { name: sceneEditorCopy.toolHand, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await page.keyboard.press("v")
  await expect(page.getByRole("button", { name: sceneEditorCopy.toolMove, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
})

test("the shape tray arms a preset shape and the Agent and Design switch stays on the toolbar", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openSceneEditor(page, context, stack)
  const bar = page.getByRole("toolbar", { name: sceneEditorCopy.tools })
  const widths = await Promise.all(
    [sceneEditorCopy.toolMove, shapeCopy.tool, sceneEditorCopy.textTool, sceneEditorCopy.actions].map(
      async (name) =>
        (await bar.getByRole("button", { name, exact: true }).locator("svg").first().boundingBox())!.width,
    ),
  )
  expect(new Set(widths).size).toBe(1)
  await page.getByRole("button", { name: shapeCopy.tool }).click()
  const tray = page.locator("[data-shape-tray]")
  await expect(tray).toBeVisible()
  const trayBox = (await tray.boundingBox())!
  const barBox = (await bar.boundingBox())!
  expect(Math.abs(trayBox.x + trayBox.width / 2 - (barBox.x + barBox.width / 2))).toBeLessThan(1.5)
  const art = async (name: string) =>
    (await tray.getByRole("button", { name, exact: true }).locator("svg").boundingBox())!
  expect((await art(shapeCopy.shapes.star ?? "")).width).toBe(26)
  expect((await art(shapeCopy.line)).width).toBe(22)
  await expect(page.getByRole("button", { name: sceneEditorCopy.panelDesign })).toBeVisible()
  await page.getByRole("button", { name: shapeCopy.shapes.star ?? "", exact: true }).click()
  await dragSlide(page, { x: 300, y: 600 }, { x: 500, y: 800 })
  await expect.poll(async () => (await picked(page, stack, opened)).node?.geometry.kind).toBe("preset")
  const star = (await picked(page, stack, opened)).node!
  expect(star.geometry).toMatchObject({ name: "star5" })
  expect(star.fills).toEqual([{ kind: "solid", color: shapeFill.toLowerCase() }])
  const agent = page.getByRole("button", { name: sceneEditorCopy.panelAgent })
  const design = page.getByRole("button", { name: sceneEditorCopy.panelDesign })
  await expect(agent).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("[data-aira-panel]")).toBeVisible()
  await design.click()
  await expect(design).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("[data-aira-panel]")).toBeHidden()
  await expect(agent).toBeVisible()
  await agent.click()
  await expect(page.locator("[data-aira-panel]")).toBeVisible()
})
