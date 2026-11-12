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

type Head = {
  readonly head: Box
  readonly group: Box
  readonly icon: Box
  readonly chevron: Box
  readonly ring: Box
  readonly ringMark: Box
  readonly pen: Box
  readonly titleLook: Look
  readonly ringStroke: readonly string[]
}

async function headRegions(page: Page): Promise<Head> {
  return page.evaluate(() => {
    const head = document.querySelector("[data-editor-panel] [data-slot=conversation-head]")
    if (head === null) throw new Error("missing head")
    const box = (element: Element | null | undefined) => {
      if (element === null || element === undefined) throw new Error("missing head region")
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height }
    }
    const group = head.querySelector("[data-aira-history]") ?? head.firstElementChild
    const marks = group?.querySelectorAll("svg") ?? []
    const right = head.lastElementChild
    const ring = right?.firstElementChild
    const style = group === null ? undefined : getComputedStyle(group)
    return {
      head: box(head),
      group: box(group),
      icon: box(marks[0]),
      chevron: box(marks[marks.length - 1]),
      ring: box(ring),
      ringMark: box(ring?.querySelector("svg")),
      pen: box(right?.lastElementChild),
      titleLook: {
        "font-size": style?.fontSize ?? "",
        color: style?.color ?? "",
        "line-height": style?.lineHeight ?? "",
      },
      ringStroke: [...(ring?.querySelectorAll("circle") ?? [])].map(
        (circle) => circle.getAttribute("stroke-width") ?? "",
      ),
    }
  })
}

const usage = { used: 0.76, allowed: 2, resets: "2026-11-16T00:00:00.000Z" }
const answer = "Your title now leads with the Q3 number."

async function mockAira(page: Page, hold: boolean): Promise<void> {
  await page.route("**/aira/usage", (route) =>
    route.fulfill({ json: { ok: true, account: { email: "person@example.com" }, usage } }),
  )
  await page.route("**/aira/turn", async (route) => {
    if (hold) return
    const lines = [
      { type: "text", text: answer },
      { type: "end", ok: true, stop: "end_turn", content: [{ type: "text", text: answer }], usage },
    ]
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: lines.map((line) => `${JSON.stringify(line)}\n`).join(""),
    })
  })
}

function expectHead(real: Head, design: Head, state: string) {
  expectNear(real.head, design.head, `${state} head`)
  expectNear(real.group, design.group, `${state} history control`, ["x", "y", "height"])
  expectNear(real.icon, design.icon, `${state} history icon`)
  expectNear(real.chevron, design.chevron, `${state} chevron`, ["y", "width", "height"])
  expect(
    Math.abs(
      real.group.x +
        real.group.width -
        (real.chevron.x + real.chevron.width) -
        (design.group.x + design.group.width - (design.chevron.x + design.chevron.width)),
    ),
    `${state} chevron inset`,
  ).toBeLessThanOrEqual(1)
  expectNear(real.ring, design.ring, `${state} usage ring`)
  expectNear(real.ringMark, design.ringMark, `${state} usage ring mark`)
  expect(real.ringStroke).toEqual(design.ringStroke)
  expectNear(real.pen, design.pen, `${state} new chat`)
  expect(real.titleLook).toEqual(design.titleLook)
}

for (const [state, screen, ask, hold] of [
  ["empty", designed, undefined, false],
  ["working", "/screens/s42-01-editor-agent-working", "Make the Q3 investor update lead with the number", true],
  ["done", designed, "Make the Q3 investor update lead with the number", false],
  [
    "done with a long title",
    designed,
    "Rewrite_every_slide_title_so_each_one_leads_with_its_number_and_reads_well_on_its_own_without_the_body",
    false,
  ],
] as const) {
  test(`the Agent panel head sits where the designed head puts it when ${state}`, async ({ page }) => {
    await page.goto(screen)
    const design = await headRegions(page)
    await mockAira(page, hold)
    await openClean(page)
    const side = page.locator("[data-editor-panel]")
    await expect(side.getByRole("button", { name: "Weekly usage" })).toBeVisible()
    if (ask !== undefined) {
      await side.getByRole("textbox", { name: "Ask Aira" }).fill(ask)
      await page.keyboard.press("Enter")
      if (hold) await expect(side.getByRole("button", { name: "Stop" })).toBeVisible()
      else await expect(side.getByText(answer, { exact: true })).toBeVisible()
    }
    const real = await headRegions(page)
    expectHead(real, design, state)
    expect(real.group.x + real.group.width).toBeLessThanOrEqual(real.ring.x)
  })
}
