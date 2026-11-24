import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { borderWords } from "../../apps/web/src/copy/border-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { fillCopy, fillWords } from "../../apps/web/src/copy/fill-copy"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { textWords } from "../../apps/web/src/copy/text-copy"
import { formatCopy } from "../../apps/web/src/copy/format-copy"
import { linkCopy } from "../../apps/web/src/copy/link-copy"
import { selectionColorsCopy } from "../../apps/web/src/copy/selection-colors-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { test } from "./api-stack"
import { hexes, neutralColorNames } from "./editor-design-art"
import { accent, clickSlide, landNodes, openEditor, savedNode, selectedIds, spot, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Stack = Parameters<typeof savedNode>[0]
type Saved = Record<string, any>

const saved = async (stack: Stack, opened: Opened, id: string) => (await savedNode(stack, opened, id)) as Saved
const panel = (page: Page) => page.locator("[data-design-panel]")
const section = (page: Page, title: string) => panel(page).locator(`[data-design-section="${title}"]`)
const stage = (page: Page) => page.locator("[data-editor-stage]")
const node = (page: Page, id: string) => page.locator(`[data-slide-box] [data-node="${id}"]`)
const undo = (page: Page) => page.keyboard.press("ControlOrMeta+z")

async function typeInto(field: Locator, value: string) {
  await field.fill(value)
  await field.press("Tab")
}

async function designing(page: Page, context: Parameters<typeof openEditor>[1], stack: Stack) {
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await expect(panel(page)).toBeVisible()
  return opened
}

const words = (chars: string) => ({
  chars,
  spans: [],
  paras: [{}],
  style: "body",
  resize: "fixed",
  alignV: "top",
})

async function reloadIntoDesign(page: Page) {
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
}

async function layers(page: Page, context: Parameters<typeof openEditor>[1], stack: Stack) {
  const opened = await designing(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: { name: "Words", box: spot(100, 100, 700, 120), text: words("Quarterly review") },
    },
    {
      id: "t:2",
      type: "shape",
      parent: opened.slide,
      props: {
        name: "Card",
        box: spot(100, 300, 400, 260),
        geometry: { kind: "rect" },
        fills: accent,
        strokes: [{ kind: "solid", color: hexes.edge }],
        stroke: { weight: 2, align: "inside", dash: "solid" },
      },
    },
    {
      id: "t:3",
      type: "shape",
      parent: opened.slide,
      props: {
        name: "Photo",
        box: spot(600, 300, 400, 260),
        geometry: { kind: "rect" },
        fills: [{ kind: "image", asset: "e".repeat(64), fit: "tile" }],
      },
    },
    {
      id: "t:4",
      type: "frame",
      parent: opened.slide,
      props: {
        name: "Panel",
        box: spot(1100, 300, 600, 300),
        fills: [{ kind: "solid", color: { var: "background2" } }],
        layout: { mode: "row", gap: 16, padding: { t: 0, r: 0, b: 0, l: 0 }, align: "top-left" },
      },
    },
    {
      id: "t:5",
      type: "frame",
      parent: opened.slide,
      props: {
        name: editorCopy.chart,
        box: spot(1100, 700, 600, 260),
        chart: {
          kind: "column",
          categories: ["Q1", "Q2", "Q3"],
          series: [{ name: "Revenue", values: [12, 19, 15] }],
          labels: true,
        },
      },
    },
  ])
  await expect(node(page, "t:5")).toBeVisible()
  return opened
}

test("with nothing selected the panel is the old slide panel: the head, template style, a background that takes solid, gradient and a colour, and selection colours", async ({
  page,
  context,
  stack,
}) => {
  const opened = await layers(page, context, stack)
  await expect(panel(page).getByText(designCopy.slide(1), { exact: true })).toBeVisible()
  for (const title of [designCopy.templateStyle, designCopy.background, selectionColorsCopy.section])
    await expect(section(page, title)).toBeVisible()
  await expect(page.getByRole("tab", { name: "Animate" })).toHaveCount(0)

  const background = section(page, designCopy.background)
  await background.getByRole("button", { name: fillWords.gradient, exact: true }).click()
  await expect.poll(async () => (await saved(stack, opened, opened.slide)).fills?.[0]?.kind).toBe("gradient")
  await background.getByRole("button", { name: fillWords.solid, exact: true }).click()
  await expect.poll(async () => (await saved(stack, opened, opened.slide)).fills?.[0]?.kind).toBe("solid")
  await background.getByRole("button", { name: /^Background color/ }).click()
  await page.getByRole("button", { name: neutralColorNames.accent3, exact: true }).first().click()
  await page.keyboard.press("Escape")
  await expect
    .poll(async () => (await saved(stack, opened, opened.slide)).fills?.[0]?.color)
    .toEqual({ var: "accent3" })
  await stage(page).click({ position: { x: 20, y: 20 } })
  await undo(page)
  await expect.poll(async () => (await saved(stack, opened, opened.slide)).fills?.[0]?.kind).toBe("solid")
  await expect
    .poll(async () => (await saved(stack, opened, opened.slide)).fills?.[0]?.color)
    .not.toEqual({ var: "accent3" })
  await reloadIntoDesign(page)
  await expect(section(page, designCopy.background)).toBeVisible()
})

test("template style reads out the deck's theme and has nothing to open", async ({ page, context, stack }) => {
  const opened = await designing(page, context, stack)
  const { theme } = await saved(stack, opened, "s:1")
  const card = section(page, designCopy.templateStyle).locator("[data-template-style]")
  await expect(card).toBeVisible()
  await expect(card).toContainText(theme.fonts.heading as string)
  await expect(section(page, designCopy.templateStyle).getByRole("button")).toHaveCount(0)
  await card.click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("a text layer shows the old Text section and each control writes its spans, undoes and survives a reload", async ({
  page,
  context,
  stack,
}) => {
  const opened = await layers(page, context, stack)
  await clickSlide(page, 300, 160)
  expect(await selectedIds(page)).toEqual(["t:1"])
  const text = panel(page)
  for (const title of [linkCopy.section, fillCopy.section]) await expect(section(page, title)).toBeVisible()
  const read = async () => (await saved(stack, opened, "t:1")).text

  await typeInto(text.getByRole("textbox", { name: formatCopy.sizeGroup, exact: true }), "40")
  await expect.poll(async () => (await read()).spans).toEqual([{ end: 16, size: 40 }])
  await text.getByRole("button", { name: formatCopy.named.bold, exact: true }).click()
  await expect.poll(async () => (await read()).spans[0]?.bold).toBe(true)
  await text.getByRole("button", { name: formatCopy.named.italic, exact: true }).click()
  await text.getByRole("button", { name: formatCopy.named.underline, exact: true }).click()
  await text.getByRole("button", { name: formatCopy.named.strike, exact: true }).click()
  await expect.poll(async () => (await read()).spans[0]).toMatchObject({ italic: true, underline: true, strike: true })
  await text.locator("[data-segments]").first().getByRole("button").nth(1).click()
  await expect.poll(async () => (await read()).paras[0]?.align).toBe("center")
  await text.getByRole("button", { name: textWords["list.bullets"], exact: true }).click()
  await expect.poll(async () => (await read()).paras[0]?.list).toBe("bullet")

  await section(page, fillCopy.section).getByRole("button", { name: /Text/ }).click()
  await page.getByRole("button", { name: neutralColorNames.accent2, exact: true }).first().click()
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await read()).spans[0]?.color).toEqual({ var: "accent2" })

  await typeInto(section(page, linkCopy.section).getByRole("textbox"), "https://airdesign.app")
  await expect.poll(async () => (await saved(stack, opened, "t:1")).link).toBe("https://airdesign.app")
  await stage(page).click({ position: { x: 20, y: 20 } })
  await undo(page)
  await expect.poll(async () => (await saved(stack, opened, "t:1")).link).toBeUndefined()
  await reloadIntoDesign(page)
  await clickSlide(page, 300, 160)
  await expect(panel(page).getByRole("button", { name: formatCopy.named.bold, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
})

test("a shape shows fill and border, paints before the server answers, and saves an undo", async ({
  page,
  context,
  stack,
}) => {
  const opened = await layers(page, context, stack)
  await clickSlide(page, 300, 400)
  expect(await selectedIds(page)).toEqual(["t:2"])
  for (const title of [fillCopy.section, designCopy.border]) await expect(section(page, title)).toBeVisible()
  const read = async () => saved(stack, opened, "t:2")

  const fill = section(page, fillCopy.section)
  const release = await heldEdits(page)
  try {
    await fill.getByRole("button", { name: fillWords.gradient, exact: true }).click()
    await expect(node(page, "t:2").locator('[data-paint="gradient"]')).toBeVisible()
    expect((await read()).fills[0].kind).toBe("solid")
  } finally {
    release()
  }
  await expect.poll(async () => (await read()).fills[0].kind).toBe("gradient")
  await fill.getByRole("button", { name: fillWords.solid, exact: true }).click()
  await expect.poll(async () => (await read()).fills[0].kind).toBe("solid")
  await fill.getByRole("button", { name: fillWords.none, exact: true }).click()
  await expect.poll(async () => (await read()).fills).toBeUndefined()

  const border = section(page, designCopy.border)
  await border.getByRole("button", { name: borderWords["border.dash"]!, exact: true }).click()
  await expect.poll(async () => (await read()).stroke.dash).toBe("dash")
  const colors = section(page, selectionColorsCopy.section)
  await expect(colors.locator("[data-selection-colors] > div")).toHaveCount(1)
  await colors.locator("[data-selection-colors] > div").first().getByRole("button").first().click()
  await page.getByRole("button", { name: neutralColorNames.accent4, exact: true }).first().click()
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await read()).strokes[0].color).toEqual({ var: "accent4" })

  await stage(page).click({ position: { x: 20, y: 20 } })
  await undo(page)
  await expect.poll(async () => (await read()).strokes[0].color).toBe(hexes.edge)
  await reloadIntoDesign(page)
  await clickSlide(page, 300, 400)
  await expect(
    section(page, designCopy.border).getByRole("button", { name: borderWords["border.dash"]! }),
  ).toHaveAttribute("aria-pressed", "true")
})

test("a tiled picture shows its mode alongside the current fit options, a frame removes auto layout, and a chart edits data", async ({
  page,
  context,
  stack,
}) => {
  const opened = await layers(page, context, stack)
  await clickSlide(page, 800, 400)
  expect(await selectedIds(page)).toEqual(["t:3"])
  await expect(
    section(page, fillCopy.section).getByRole("button", { name: fillWords.image, exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  const { pictureCopy } = await import("../../apps/web/src/copy/picture-copy")
  const { pictureWords } = await import("../../apps/web/src/copy/picture-panel-copy")
  await expect(page.getByRole("button", { name: pictureCopy.replace, exact: true })).toBeVisible()
  const mode = section(page, fillCopy.section).getByRole("combobox", { name: pictureCopy.mode })
  await expect(mode.getByText(pictureWords.tile, { exact: true })).toBeVisible()
  await mode.click()
  await expect(page.getByRole("option")).toHaveText([pictureWords.fill, pictureWords.fit, pictureWords.crop])
  await page.getByRole("option", { name: pictureWords.fit, exact: true }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:3")).fills[0].fit).toBe("fit")

  await clickSlide(page, 1300, 400)
  expect(await selectedIds(page)).toEqual(["t:4"])
  await page.locator("[data-auto-layout]").getByRole("button", { name: designCopy.removeAutoLayout }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:4")).layout?.mode).toBe("none")

  await clickSlide(page, 1300, 850)
  expect(await selectedIds(page)).toEqual(["t:5"])
  const chart = page.locator('[data-panel-section="chart"]')
  await expect(chart).toBeVisible()
  await page.locator("[data-chart-data]").getByLabel("1", { exact: true }).first().fill("30")
  await page.locator("[data-chart-data]").getByLabel("1", { exact: true }).first().press("Tab")
  await expect.poll(async () => (await saved(stack, opened, "t:5")).chart.series[0].values[0]).toBe(30)
  await page.getByRole("button", { name: editorCopy.addRow }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:5")).chart.categories.length).toBe(4)
  await typeInto(chart.getByLabel(editorCopy.seriesName(1), { exact: true }), "Plan")
  await expect.poll(async () => (await saved(stack, opened, "t:5")).chart.series[0].name).toBe("Plan")
  await page.getByRole("button", { name: editorCopy.addSeries }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:5")).chart.series.length).toBe(2)
  await typeInto(chart.getByLabel(editorCopy.seriesName(2), { exact: true }), "Actual")
  await expect.poll(async () => (await saved(stack, opened, "t:5")).chart.series[1].name).toBe("Actual")
  const second = page.locator("[data-chart-data]").getByLabel("2", { exact: true }).first()
  await typeInto(second, "3.1")
  await expect.poll(async () => (await saved(stack, opened, "t:5")).chart.series[1].values[0]).toBe(3.1)
  expect(await second.evaluate((field) => field.scrollWidth <= field.clientWidth)).toBe(true)
  await expect(second).toHaveValue("3.1")
  await chart.getByRole("combobox", { name: editorCopy.chartKind }).click()
  await page.getByRole("option", { name: editorCopy.kinds.line, exact: true }).click()
  await expect.poll(async () => (await saved(stack, opened, "t:5")).chart.kind).toBe("line")
  await stage(page).click({ position: { x: 20, y: 20 } })
  await undo(page)
  await expect.poll(async () => (await saved(stack, opened, "t:5")).chart.kind).toBe("column")
})

test("several layers share one panel and Align moves them to the selection's edge", async ({
  page,
  context,
  stack,
}) => {
  const opened = await layers(page, context, stack)
  await clickSlide(page, 300, 400)
  await page.keyboard.down(shortcutCopy.chord.other.shift)
  await clickSlide(page, 800, 400)
  await page.keyboard.up(shortcutCopy.chord.other.shift)
  await expect(panel(page).getByText(designCopy.selected(2), { exact: true })).toBeVisible()
  await panel(page)
    .getByRole("button", { name: /align right/i })
    .first()
    .click()
  await expect.poll(async () => (await saved(stack, opened, "t:2")).box.x).toBe(600)
  expect((await saved(stack, opened, "t:3")).box.x).toBe(600)
})

async function heldEdits(page: Page): Promise<() => void> {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  await page.route(`**${doomRoutes.edit.path}`, async (route) => {
    await gate
    await route.fallback()
  })
  return release
}

const pictureFile = join(process.cwd(), "scripts/pptx-fixtures/picture.png")

test("an image fill is picked from a file for a shape, the slide background and a picture's replace, and shows in the panel", async ({
  page,
  context,
  stack,
}) => {
  const opened = await layers(page, context, stack)
  const sha = /^[0-9a-f]{64}$/
  const choose = async (open: () => Promise<void>) => {
    const chooser = page.waitForEvent("filechooser")
    await open()
    await (await chooser).setFiles(pictureFile)
  }

  await clickSlide(page, 300, 400)
  await choose(() =>
    section(page, fillCopy.section).getByRole("button", { name: fillWords.image, exact: true }).click(),
  )
  await expect.poll(async () => (await saved(stack, opened, "t:2")).fills[0].asset).toMatch(sha)
  await expect(page.locator("[data-picture-preview] img")).toBeVisible()
  expect((await saved(stack, opened, "t:2")).fills[0].fit).toBe("fill")

  await clickSlide(page, 800, 400)
  const { pictureCopy } = await import("../../apps/web/src/copy/picture-copy")
  await choose(() => page.getByRole("button", { name: pictureCopy.replace, exact: true }).click())
  await expect.poll(async () => (await saved(stack, opened, "t:3")).fills[0].asset).toMatch(sha)

  await stage(page).click({ position: { x: 20, y: 20 } })
  await choose(() =>
    section(page, designCopy.background).getByRole("button", { name: fillWords.image, exact: true }).click(),
  )
  await expect.poll(async () => (await saved(stack, opened, opened.slide)).fills?.[0]?.asset).toMatch(sha)
  await undo(page)
  await expect.poll(async () => (await saved(stack, opened, opened.slide)).fills).toBeUndefined()
})
