import { expect, type Page } from "@playwright/test"
import { sceneEditorCopy } from "../../apps/web/src/copy/scene-editor-copy"
import { sampleHexes } from "../../apps/web/src/scene-editor/panel-art"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { test } from "./api-stack"
import { accent, clickSlide, landNodes, openSceneEditor, savedNode, selectedIds, spot, type Opened } from "./scene-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Stack = Parameters<typeof savedNode>[0]
type Saved = Record<string, any>

const section = (page: Page, name: string) => page.locator(`[data-panel-section="${name}"]`)
const saved = async (stack: Stack, opened: Opened, id: string) => (await savedNode(stack, opened, id)) as Saved

async function typeInto(page: Page, name: string, label: string, value: string) {
  const field = section(page, name).getByLabel(label, { exact: true })
  await field.fill(value)
  await field.press("Tab")
}

async function openDesign(page: Page, context: Parameters<typeof openSceneEditor>[1], stack: Stack) {
  const opened = await openSceneEditor(page, context, stack)
  await page.getByRole("button", { name: sceneEditorCopy.panelDesign, exact: true }).click()
  return opened
}

async function layers(page: Page, context: Parameters<typeof openSceneEditor>[1], stack: Stack) {
  const opened = await openDesign(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: { name: "alpha", box: spot(100, 700, 200, 120), fills: accent },
    },
    {
      id: "t:2",
      type: "frame",
      parent: opened.slide,
      props: { name: "beta", box: spot(600, 600, 500, 300), fills: accent },
    },
    {
      id: "t:3",
      type: "shape",
      parent: opened.slide,
      props: { name: "gamma", box: spot(1300, 700, 200, 120), fills: accent },
    },
  ])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(4)
  return opened
}

test("the panel's sections follow what is selected, and the position fields write the layer's box", async ({
  page,
  context,
  stack,
}) => {
  const opened = await layers(page, context, stack)
  await expect(page.locator("[data-design-panel]")).toBeVisible()
  await expect(section(page, "slide-fill")).toBeVisible()
  await clickSlide(page, 200, 760)
  expect(await selectedIds(page)).toEqual(["t:1"])
  for (const name of ["box", "sizing", "appearance", "fills", "strokes", "effects"])
    await expect(section(page, name)).toBeVisible()
  await expect(section(page, "layout")).toHaveCount(0)
  await typeInto(page, "box", sceneEditorCopy.fieldX, "340")
  await typeInto(page, "box", sceneEditorCopy.fieldW, "420")
  await expect
    .poll(async () => (await saved(stack, opened, "t:1")).box)
    .toMatchObject({ x: 340, y: 700, w: 420, h: 120 })
  await typeInto(page, "box", sceneEditorCopy.fieldRotation, "30")
  await expect.poll(async () => (await saved(stack, opened, "t:1")).box.rotation).toBe(30)
  await page.keyboard.press("Escape")
  await page.locator("[data-scene-stage]").click({ position: { x: 40, y: 40 } })
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await saved(stack, opened, "t:1")).box.rotation).toBe(0)
})

test("fills take a theme colour first and a hex second, strokes add a weight, and opacity and radius write", async ({
  page,
  context,
  stack,
}) => {
  const opened = await layers(page, context, stack)
  await clickSlide(page, 200, 760)
  await section(page, "fills")
    .getByRole("button", { name: `${sceneEditorCopy.fills} ${sceneEditorCopy.paintColor}` })
    .click()
  await page.getByRole("button", { name: sceneEditorCopy.colorNames.accent3, exact: true }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:1")).fills[0].color).toEqual({ var: "accent3" })
  await page.getByLabel(sceneEditorCopy.hexColor, { exact: true }).fill(sampleHexes.fill)
  await page.getByRole("button", { name: sceneEditorCopy.applyHex }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:1")).fills[0].color).toBe(sampleHexes.fill)
  await page.keyboard.press("Escape")

  await section(page, "strokes")
    .getByRole("button", { name: `${sceneEditorCopy.addPaint} ${sceneEditorCopy.strokes}` })
    .click()
  await expect.poll(async () => (await saved(stack, opened, "t:1")).strokes).toHaveLength(1)
  await typeInto(page, "strokes", sceneEditorCopy.weight, "9")
  await expect.poll(async () => (await saved(stack, opened, "t:1")).stroke?.weight).toBe(9)
  await section(page, "strokes").getByRole("button", { name: sceneEditorCopy.strokeOutside }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:1")).stroke?.align).toBe("outside")

  await typeInto(page, "appearance", sceneEditorCopy.opacity, "40")
  await typeInto(page, "appearance", sceneEditorCopy.radius, "24")
  await expect.poll(async () => (await saved(stack, opened, "t:1")).opacity).toBe(0.4)
  await expect.poll(async () => (await saved(stack, opened, "t:1")).radius).toBe(24)
  await section(page, "effects").getByRole("button", { name: sceneEditorCopy.effectLifted }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:1")).effects).toBe("lifted")
})

test("a frame takes auto layout with a gap, and several layers share one edit", async ({ page, context, stack }) => {
  const opened = await layers(page, context, stack)
  await clickSlide(page, 800, 750)
  expect(await selectedIds(page)).toEqual(["t:2"])
  await section(page, "layout").getByRole("button", { name: sceneEditorCopy.layoutRow }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:2")).layout?.mode).toBe("row")
  await typeInto(page, "layout", sceneEditorCopy.gap, "24")
  await expect.poll(async () => (await saved(stack, opened, "t:2")).layout?.gap).toBe(24)
  await section(page, "appearance").getByRole("switch", { name: sceneEditorCopy.clip }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:2")).clip).toBe(true)

  await clickSlide(page, 200, 760)
  await page.keyboard.down(shortcutCopy.chord.other.shift)
  await clickSlide(page, 1400, 760)
  await page.keyboard.up(shortcutCopy.chord.other.shift)
  await expect(section(page, "box")).toHaveCount(0)
  await typeInto(page, "appearance", sceneEditorCopy.opacity, "50")
  await expect.poll(async () => (await saved(stack, opened, "t:3")).opacity).toBe(0.5)
  expect((await saved(stack, opened, "t:1")).opacity).toBe(0.5)
})

test("text sets its named style and alignment, a chart edits its data and kind, and the slide has a background", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDesign(page, context, stack)
  await clickSlide(page, 600, 410)
  await section(page, "text").getByRole("combobox", { name: sceneEditorCopy.textStyle }).click()
  await page.getByRole("option", { name: sceneEditorCopy.textStyles.heading, exact: true }).click()
  await section(page, "text").getByRole("button", { name: sceneEditorCopy.alignCenter }).click()
  await expect
    .poll(async () => (await saved(stack, opened, "s:4")).text)
    .toMatchObject({ style: "heading", paras: [{ align: "center" }] })

  await page.getByRole("button", { name: sceneEditorCopy.actions, exact: true }).click()
  await page.getByRole("button", { name: sceneEditorCopy.chartKinds.column, exact: true }).click()
  const [chart] = await selectedIds(page)
  await expect(section(page, "chart")).toBeVisible()
  await page.locator("[data-chart-data]").getByLabel("1", { exact: true }).first().fill("30")
  await page.locator("[data-chart-data]").getByLabel("1", { exact: true }).first().press("Tab")
  await expect.poll(async () => (await saved(stack, opened, chart ?? "")).chart.series[0].values[0]).toBe(30)
  await page.getByRole("button", { name: sceneEditorCopy.addRow }).click()
  await expect.poll(async () => (await saved(stack, opened, chart ?? "")).chart.categories.length).toBe(5)
  await section(page, "chart").getByRole("combobox", { name: sceneEditorCopy.chartKind }).click()
  await page.getByRole("option", { name: sceneEditorCopy.kinds.line, exact: true }).click()
  await expect.poll(async () => (await saved(stack, opened, chart ?? "")).chart.kind).toBe("line")

  await page.keyboard.press("Escape")
  await page.locator("[data-scene-stage]").click({ position: { x: 20, y: 20 } })
  await expect(section(page, "slide-fill")).toBeVisible()
  await section(page, "slide-fill")
    .getByRole("button", { name: `${sceneEditorCopy.addPaint} ${sceneEditorCopy.fills}` })
    .click()
  await expect.poll(async () => (await saved(stack, opened, opened.slide)).fills).toHaveLength(1)
})

test("with nothing selected the panel shows the slide's fill and the deck's theme colours, and a hex writes the theme", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDesign(page, context, stack)
  await expect(page.locator("[data-design-panel]")).toBeVisible()
  await expect(section(page, "slide-fill")).toBeVisible()
  await expect(section(page, "theme")).toBeVisible()
  const accent = section(page, "theme").getByLabel(sceneEditorCopy.colorNames.accent1, { exact: true })
  const first = await accent.inputValue()
  expect(first).toMatch(/^#[0-9a-f]{6}$/)
  await typeInto(page, "theme", sceneEditorCopy.colorNames.accent1, sampleHexes.theme)
  await expect.poll(async () => (await saved(stack, opened, "s:1")).theme.colors.accent1).toBe(sampleHexes.theme)
  await expect(accent).toHaveValue(sampleHexes.theme)
  await typeInto(page, "theme", sceneEditorCopy.colorNames.accent1, "not a colour")
  await expect(accent).toHaveValue(sampleHexes.theme)
  await page.locator("[data-scene-stage]").click({ position: { x: 40, y: 40 } })
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await saved(stack, opened, "s:1")).theme.colors.accent1).toBe(first)
})
