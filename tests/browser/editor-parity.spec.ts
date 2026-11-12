import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const clean = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")
const designed = "/screens/s42-02-editor-agent-run-complete"
const toolCount = 6

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

type Look = Readonly<Record<string, string>>

type Regions = {
  readonly sidebar: Box
  readonly sidebarHead: Box
  readonly canvas: Box
  readonly label: Box
  readonly slide: Box
  readonly toolbar: Box
  readonly tools: readonly Box[]
  readonly panel: Box
  readonly panelHead: Box
  readonly readout: Box
  readonly exportButton: Box
  readonly slideLook: Look
  readonly labelLook: Look
  readonly item: Box
  readonly itemLook: Look
  readonly card: Box
  readonly cardLook: Look
  readonly activeLook: Look
}

async function regions(page: Page, active: number, plain: number): Promise<Regions> {
  await page.evaluate(async () => {
    await document.fonts.load('13px "Geist Variable"')
    await document.fonts.ready
  })
  return page.evaluate(
    ({ active, plain, toolCount }) => {
      const found = (selector: string, from: ParentNode = document): Element => {
        const element = from.querySelector(selector)
        if (element === null) throw new Error(`missing ${selector}`)
        return element
      }
      const box = (element: Element | null | undefined) => {
        if (element === null || element === undefined) throw new Error("missing region")
        const { x, y, width, height } = element.getBoundingClientRect()
        return { x, y, width, height }
      }
      const look = (element: Element | null | undefined, names: readonly string[]) => {
        if (element === null || element === undefined) throw new Error("missing look")
        const style = getComputedStyle(element)
        return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]))
      }
      const sidebar = found("[data-editor-sidebar]")
      const label = found("[data-slide-label]")
      const toolbar = found("[data-editor-toolbar]")
      const panel = found("[data-editor-panel]")
      const head = panel.firstElementChild
      const items = document.querySelectorAll("[data-slide-item]")
      const item = items[plain]
      const card = item?.lastElementChild
      return {
        sidebar: box(sidebar),
        sidebarHead: box(sidebar.firstElementChild),
        canvas: box(found("[data-editor-canvas]")),
        label: box(label),
        slide: box(label.nextElementSibling),
        toolbar: box(toolbar),
        tools: [...toolbar.querySelectorAll("button")].slice(0, toolCount).map(box),
        panel: box(panel),
        panelHead: box(head),
        readout: box(head?.firstElementChild),
        exportButton: box(head?.lastElementChild),
        slideLook: look(label.nextElementSibling, ["box-shadow", "border-radius"]),
        labelLook: look(label, ["font-size", "color"]),
        item: box(item),
        itemLook: look(item, ["border-radius", "padding", "gap"]),
        card: box(card),
        cardLook: look(card, ["border-radius", "box-shadow", "background-color", "overflow"]),
        activeLook: look(items[active], ["background-color", "border-radius"]),
      }
    },
    { active, plain, toolCount },
  )
}

function expectNear(
  actual: Box,
  expected: Box,
  name: string,
  keys: readonly (keyof Box)[] = ["x", "y", "width", "height"],
) {
  for (const key of keys) {
    expect(
      Math.abs(actual[key] - expected[key]),
      `${name} ${key}: ${actual[key]} against ${expected[key]}`,
    ).toBeLessThanOrEqual(1)
  }
}

function relative(box: Box, origin: Box): Box {
  return { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height }
}

async function openClean(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(clean)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
  await expect(page.locator("[data-slide-entry='1'] [data-thumb-paint]")).toContainText("Hello")
}

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("the real editor's sidebar, canvas, toolbar and panel head sit where the designed editor puts them", async ({
  page,
}) => {
  await page.goto(designed)
  const design = await regions(page, 2, 1)
  await openClean(page)
  const real = await regions(page, 0, 0)

  expectNear(real.sidebar, design.sidebar, "sidebar")
  expectNear(real.sidebarHead, design.sidebarHead, "sidebar head")
  expectNear(real.canvas, design.canvas, "canvas column")
  expectNear(real.label, design.label, "slide label")
  expectNear(real.slide, design.slide, "slide")
  expect(real.slideLook).toEqual(design.slideLook)
  expect(real.labelLook).toEqual(design.labelLook)
  expectNear(real.panel, design.panel, "panel")
  expectNear(real.panelHead, design.panelHead, "panel head")
  expectNear(real.exportButton, design.exportButton, "Export")
  expectNear(real.readout, design.readout, "zoom readout", ["x", "y", "height"])

  expectNear(real.toolbar, design.toolbar, "toolbar", ["y", "height"])
  expect(
    Math.abs(real.toolbar.x + real.toolbar.width / 2 - (design.toolbar.x + design.toolbar.width / 2)),
  ).toBeLessThanOrEqual(1)
  expect(real.tools).toHaveLength(toolCount)
  real.tools.forEach((tool, index) => {
    const drawn = design.tools[index]
    if (drawn === undefined) throw new Error(`design tool ${index}`)
    expectNear(relative(tool, real.toolbar), relative(drawn, design.toolbar), `tool ${index}`)
  })

  expectNear(real.item, design.item, "slide item", ["x", "width", "height"])
  expect(real.itemLook).toEqual(design.itemLook)
  expectNear(relative(real.card, real.item), relative(design.card, design.item), "card")
  expect(real.cardLook).toEqual(design.cardLook)
  expect(real.activeLook).toEqual(design.activeLook)
})
