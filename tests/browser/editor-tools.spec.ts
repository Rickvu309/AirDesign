import { expect, type Page } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, dragSlide, openEditor, savedNode, selectedIds, type Opened } from "./editor-deck"

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
  const opened = await openEditor(page, context, stack)
  await page.keyboard.press("r")
  await dragSlide(page, { x: 300, y: 640 }, { x: 700, y: 900 })
  await expect(page.getByRole("button", { name: editorCopy.toolMove, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await expect.poll(async () => (await picked(page, stack, opened)).node?.geometry.kind).toBe("rect")
  const made = (await picked(page, stack, opened)).node!
  expect(near(made.box.x, 300) && near(made.box.y, 640) && near(made.box.w, 400) && near(made.box.h, 260)).toBe(true)
  expect(made.fills).toEqual([{ kind: "solid", color: { var: "background2", tint: -0.06 } }])

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
  const opened = await openEditor(page, context, stack)
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
  const opened = await openEditor(page, context, stack)
  await page.keyboard.press("ControlOrMeta+k")
  const panel = page.locator("[data-actions-panel]")
  await expect(panel).toBeVisible()
  const bar = await page.getByRole("toolbar", { name: editorCopy.tools }).boundingBox()
  const open = await page.locator('[data-slot="popover-content"]').boundingBox()
  expect(near((open?.x ?? 0) + (open?.width ?? 0) / 2, (bar?.x ?? 0) + (bar?.width ?? 0) / 2, 3)).toBe(true)
  expect(near((bar?.y ?? 0) - ((open?.y ?? 0) + (open?.height ?? 0)), 12, 3)).toBe(true)

  const search = page.getByRole("combobox", { name: editorCopy.actionsSearch })
  await expect(search).toBeFocused()
  await expect(search).toHaveCSS("outline-style", "none")
  await search.fill("rocket")
  await page.getByRole("option", { name: "rocket", exact: true }).click()
  await expect.poll(async () => (await picked(page, stack, opened)).node?.geometry.kind).toBe("icon")
  const icon = (await picked(page, stack, opened)).node!
  expect(icon.geometry).toMatchObject({ name: "lucide/rocket" })
  expect(near(icon.box.x, 900, 1) && near(icon.box.y, 808, 1)).toBe(true)

  for (const kind of ["column", "bar", "stacked", "waterfall", "line", "pie"] as const) {
    await page.getByRole("button", { name: editorCopy.actions, exact: true }).click()
    await page.getByRole("option", { name: editorCopy.chartKinds[kind], exact: true }).click()
    await expect
      .poll(async () => (await picked(page, stack, opened)).node?.instance)
      .toMatchObject({ component: { id: kind === "bar" ? "clustered-chart" : kind }, parts: expect.any(Array) })
  }
  await expect.poll(() => page.locator('[data-slide-box] [data-node^="p"]').count()).toBeGreaterThan(4)
})

test("in Actions, Enter runs the top match, the arrow keys move the highlight, and the Deck group title finds Export as PDF", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const open = () => page.getByRole("button", { name: editorCopy.actions, exact: true }).click()
  const search = page.getByRole("combobox", { name: editorCopy.actionsSearch })
  await open()
  await search.fill("pie")
  await expect(page.getByRole("option", { selected: true })).toHaveText(editorCopy.chartKinds.pie)
  await page.keyboard.press("Enter")
  await expect
    .poll(async () => (await picked(page, stack, opened)).node?.instance)
    .toMatchObject({ component: { id: "pie" } })
  await expect(search).toBeHidden()

  await open()
  await search.fill("chart")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowUp")
  await expect(page.getByRole("option", { selected: true })).toHaveText(editorCopy.chartKinds.bar)
  await page.keyboard.press("Enter")
  await expect
    .poll(async () => (await picked(page, stack, opened)).node?.instance)
    .toMatchObject({ component: { id: "clustered-chart" }, variant: { orientation: "bar" } })

  await open()
  await search.fill(editorCopy.deckGroup.toLowerCase())
  await expect(page.getByRole("option", { name: editorCopy.exportPdf })).toBeVisible()
})

test("in Actions, the Enter that ends an IME composition, as Vietnamese Telex sends it, commits the word and runs nothing", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.actions, exact: true }).click()
  const search = page.getByRole("combobox", { name: editorCopy.actionsSearch })
  await expect(search).toBeFocused()
  await page.evaluate(() =>
    window.addEventListener(
      "keydown",
      (event) => {
        document.body.dataset["keyComposing"] = String(event.isComposing)
      },
      { capture: true },
    ),
  )
  const ime = await context.newCDPSession(page)
  await ime.send("Input.imeSetComposition", { text: "pie", selectionStart: 3, selectionEnd: 3 })
  await expect(page.getByRole("option", { selected: true })).toHaveText(editorCopy.chartKinds.pie)
  await page.keyboard.press("Enter")
  await expect(page.locator("body")).toHaveAttribute("data-key-composing", "true")
  await expect(search).toHaveValue("pie")
  await ime.send("Input.insertText", { text: "pie" })
  await expect(search).toHaveValue("pie")
  expect((await picked(page, stack, opened)).node?.instance).toBeUndefined()

  await page.keyboard.press("Enter")
  await expect(page.locator("body")).toHaveAttribute("data-key-composing", "false")
  await expect
    .poll(async () => (await picked(page, stack, opened)).node?.instance)
    .toMatchObject({ component: { id: "pie" } })
  await expect(search).toBeHidden()
})

test("in Actions, the pointer moves the one highlight, Down walks the icon grid by row, and All icons drops the highlight", async ({
  page,
  context,
  stack,
}) => {
  await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.actions, exact: true }).click()
  const search = page.getByRole("combobox", { name: editorCopy.actionsSearch })
  const selected = page.getByRole("option", { selected: true })
  await search.fill("chart")
  await page.getByRole("option", { name: editorCopy.chartKinds.line }).hover()
  await expect(selected).toHaveCount(1)
  await expect(selected).toHaveText(editorCopy.chartKinds.line)
  await expect(search).toHaveAttribute("aria-activedescendant", (await selected.getAttribute("id")) ?? "")

  await page.getByRole("button", { name: editorCopy.allIcons }).click()
  await expect(selected).toHaveCount(0)
  await expect(search).toBeFocused()
  const icons = page.locator("[data-actions-group='icons']").getByRole("option")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowDown")
  await expect(selected).toHaveAttribute("aria-label", (await icons.nth(8).getAttribute("aria-label")) ?? "")
  await page.keyboard.press("ArrowRight")
  await expect(selected).toHaveAttribute("aria-label", (await icons.nth(9).getAttribute("aria-label")) ?? "")
})

test("with one icon selected, picking an icon in Actions swaps it in place, picking it again changes nothing, and one undo puts the old one back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const pick = async (name: string) => {
    await page.getByRole("button", { name: editorCopy.actions, exact: true }).click()
    await page.getByRole("combobox", { name: editorCopy.actionsSearch }).fill(name)
    await page.getByRole("option", { name, exact: true }).click()
  }
  const layers = page.locator("[data-slide-box] [data-node]")
  await pick("rocket")
  await expect.poll(async () => (await picked(page, stack, opened)).node?.geometry.kind).toBe("icon")
  const rocket = await picked(page, stack, opened)
  const count = await layers.count()

  await pick("star")
  await expect
    .poll(async () => (await savedNode(stack, opened, rocket.id))?.geometry)
    .toMatchObject({
      name: "lucide/star",
    })
  expect(await layers.count()).toBe(count)
  expect(await selectedIds(page)).toEqual([rocket.id])
  expect(((await savedNode(stack, opened, rocket.id)) as Saved).box).toEqual(rocket.node?.box)
  await pick("star")
  expect(await layers.count()).toBe(count)
  expect(await selectedIds(page)).toEqual([rocket.id])

  await page.locator("[data-editor-stage]").click({ position: { x: 20, y: 20 } })
  await page.keyboard.press("ControlOrMeta+z")
  await expect
    .poll(async () => (await savedNode(stack, opened, rocket.id))?.geometry)
    .toMatchObject({
      name: "lucide/rocket",
    })
  expect(await layers.count()).toBe(count)
})

test("with several icons selected, picking an icon in Actions swaps every one, and one undo puts them all back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const pick = async (name: string) => {
    await page.getByRole("button", { name: editorCopy.actions, exact: true }).click()
    await page.getByRole("combobox", { name: editorCopy.actionsSearch }).fill(name)
    await page.getByRole("option", { name, exact: true }).click()
  }
  await pick("rocket")
  await expect.poll(async () => (await picked(page, stack, opened)).node?.geometry.kind).toBe("icon")
  const left = (await picked(page, stack, opened)).id
  await page.locator("[data-editor-stage]").click({ position: { x: 20, y: 20 } })
  await pick("heart")
  await expect.poll(async () => (await selectedIds(page)).length).toBe(1)
  const right = (await picked(page, stack, opened)).id
  const heart = await page.locator(`[data-slide-box] [data-node="${right}"]`).boundingBox()
  const placed = ((await savedNode(stack, opened, right)) as Saved).box.x
  await page.mouse.move((heart?.x ?? 0) + (heart?.width ?? 0) / 2, (heart?.y ?? 0) + (heart?.height ?? 0) / 2)
  await page.mouse.down()
  await page.mouse.move((heart?.x ?? 0) + (heart?.width ?? 0) / 2 + 120, (heart?.y ?? 0) + (heart?.height ?? 0) / 2, {
    steps: 8,
  })
  await page.mouse.up()
  await expect.poll(async () => ((await savedNode(stack, opened, right)) as Saved).box.x).toBeGreaterThan(placed + 200)
  const rocket = await page.locator(`[data-slide-box] [data-node="${left}"]`).boundingBox()
  await page.keyboard.down(shortcutCopy.chord.other.shift)
  await page.mouse.click((rocket?.x ?? 0) + (rocket?.width ?? 0) / 2, (rocket?.y ?? 0) + (rocket?.height ?? 0) / 2)
  await page.keyboard.up(shortcutCopy.chord.other.shift)
  expect(new Set(await selectedIds(page))).toEqual(new Set([left, right]))
  const count = await page.locator("[data-slide-box] [data-node]").count()

  await pick("star")
  for (const id of [left, right])
    await expect.poll(async () => (await savedNode(stack, opened, id))?.geometry).toMatchObject({ name: "lucide/star" })
  expect(await page.locator("[data-slide-box] [data-node]").count()).toBe(count)

  await page.locator("[data-editor-stage]").click({ position: { x: 20, y: 20 } })
  await page.keyboard.press("ControlOrMeta+z")
  await expect
    .poll(async () => (await savedNode(stack, opened, left))?.geometry)
    .toMatchObject({ name: "lucide/rocket" })
  expect((await savedNode(stack, opened, right))?.geometry).toMatchObject({ name: "lucide/heart" })
})

test("the Move menu is dark, lined up with its chevron, and marks the tool in use", async ({
  page,
  context,
  stack,
}) => {
  covers("tool-hand")
  await openEditor(page, context, stack)
  const chevron = page.getByRole("button", { name: editorCopy.moveTools })
  const toolbar = page.getByRole("toolbar", { name: editorCopy.tools })
  await expect(toolbar.locator("[data-toolbar-divider]")).toHaveCount(1)
  await chevron.click()
  const menu = page.getByRole("menu")
  await expect(menu).toBeVisible()
  const edge = await chevron.boundingBox()
  const box = await menu.boundingBox()
  expect(near(box?.x, edge?.x, 2)).toBe(true)
  await expect(menu).toHaveCSS("background-color", "rgb(30, 30, 30)")
  await expect(menu.getByRole("menuitem", { name: new RegExp(editorCopy.toolMove) })).toHaveAttribute(
    "aria-current",
    "true",
  )
  await menu.getByRole("menuitem", { name: new RegExp(editorCopy.toolHand) }).click()
  await expect(page.getByRole("button", { name: editorCopy.toolHand, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await page.keyboard.press("v")
  await expect(page.getByRole("button", { name: editorCopy.toolMove, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
})

test("the shape tray arms a preset shape and the Agent and Design switch stays on the toolbar", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const bar = page.getByRole("toolbar", { name: editorCopy.tools })
  const widths = await Promise.all(
    [editorCopy.toolMove, shapeCopy.tool, editorCopy.textTool, editorCopy.actions].map(
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
  await expect(page.getByRole("button", { name: editorCopy.panelDesign })).toBeVisible()
  await page.getByRole("button", { name: shapeCopy.shapes.star ?? "", exact: true }).click()
  await dragSlide(page, { x: 300, y: 600 }, { x: 500, y: 800 })
  await expect.poll(async () => (await picked(page, stack, opened)).node?.geometry.kind).toBe("preset")
  const star = (await picked(page, stack, opened)).node!
  expect(star.geometry).toMatchObject({ name: "star5" })
  expect(star.fills).toEqual([{ kind: "solid", color: { var: "background2", tint: -0.06 } }])
  const agent = page.getByRole("button", { name: editorCopy.panelAgent })
  const design = page.getByRole("button", { name: editorCopy.panelDesign })
  await expect(agent).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("[data-aira-panel]")).toBeVisible()
  await design.click()
  await expect(design).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("[data-aira-panel]")).toBeHidden()
  await expect(agent).toBeVisible()
  await agent.click()
  await expect(page.locator("[data-aira-panel]")).toBeVisible()
})
