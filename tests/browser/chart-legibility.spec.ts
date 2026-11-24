import { expect, type Locator } from "@playwright/test"
import { test } from "./api-stack"
import { landNodes, openEditor, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const quarters = ["Q1", "Q2", "Q3", "Q4"]
const five = ["Loss", "Zero", "Huge", "Tiny", "Major"]
const twenty = Array.from({ length: 20 }, (_, at) => `Category ${String(at + 1)}`)
const revenue = [
  { name: "Recurring revenue", values: [1200, 1350, 1440, 1550] },
  { name: "Services", values: [150, 175, 165, 190] },
]
const costs = [
  { name: "Personnel", values: [460, 585, 510, 620] },
  { name: "Vendor services", values: [210, 234, 268, 271] },
  { name: "Infrastructure", values: [85, 100, 90, 112] },
  { name: "Marketing", values: [98, 110, 124, 132] },
  { name: "General & administrative", values: [120, 142, 150, 147] },
]
const dense = twenty.map((_, at) => [1200, -300, 45.5, 880, 2500, 15][at % 6]! * (1 + (at % 3)))

const charts = [
  {
    id: "t:1",
    box: spot(40, 40, 640, 400),
    chart: { kind: "stacked", labels: true, categories: quarters, series: revenue, unit: "thousand USD" },
  },
  {
    id: "t:2",
    box: spot(720, 40, 900, 460),
    chart: { kind: "stacked", labels: true, categories: quarters, series: costs },
  },
  {
    id: "t:3",
    box: spot(40, 580, 480, 360),
    chart: {
      kind: "bar",
      labels: true,
      categories: five,
      series: [{ name: "Sales", values: [120, -30, 450.5, 88, 250] }],
      unit: "دولار",
    },
  },
  {
    id: "t:4",
    box: spot(980, 560, 900, 460),
    chart: { kind: "line", labels: true, categories: twenty, series: [{ name: "Sales", values: dense }], unit: "دولار" },
  },
]

const clashesIn = (texts: Locator) =>
  texts.evaluateAll((nodes) => {
    const labels = nodes.map((node) => {
      const range = document.createRange()
      range.selectNodeContents(node)
      return { text: node.textContent, box: range.getBoundingClientRect() }
    })
    return labels.flatMap(({ text, box }, index) =>
      labels
        .slice(index + 1)
        .filter(
          ({ box: other }) =>
            Math.min(box.right, other.right) - Math.max(box.left, other.left) > 0 &&
            Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 0,
        )
        .map((other) => [text, other.text]),
    )
  })

test("a chart keeps its scale and every series name, prints a word unit once, and paints no text over text", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await landNodes(
    stack,
    opened,
    charts.map(({ id, box, chart }) => ({ id, type: "frame", parent: opened.slide, props: { box, chart } })),
  )
  const texts = (scope: string, id: string) => page.locator(`${scope} [data-node^="${id}#~"]`).filter({ hasText: /\S/ })
  for (const { id } of charts) {
    const canvas = texts("[data-slide-box]", id)
    await expect(canvas.first()).toBeVisible()
    const painted = await canvas.allTextContents()
    await expect.poll(() => texts("[data-slide-thumb]", id).allTextContents()).toEqual(painted)
    expect.soft(await clashesIn(canvas), id).toEqual([])
  }
  const node = (id: string) => page.locator(`[data-slide-box] [data-node="${id}"]`)
  const ticks = await texts("[data-slide-box]", "t:1").and(page.locator('[data-node*="#~tick:"]')).allTextContents()
  expect(ticks).toEqual(expect.arrayContaining(["0", "2,000"]))
  await expect(node("t:1#~unit")).toHaveText("thousand USD")
  await expect(texts("[data-slide-box]", "t:1").filter({ hasText: "thousand" })).toHaveCount(1)
  await expect(page.locator('[data-slide-box] [data-node^="t:1#~value:"]')).not.toHaveCount(0)
  await expect(page.locator('[data-slide-box] [data-node^="t:2#~legend:"]')).toHaveText(costs.map(({ name }) => name))
  for (const id of ["t:3", "t:4"]) {
    await expect(node(`${id}#~unit`)).toHaveText("دولار")
    await expect(texts("[data-slide-box]", id).filter({ hasText: "دولار" })).toHaveCount(1)
    await expect(node(`${id}#~tick:0`)).toBeVisible()
  }
})

const budget = [
  "Employee salaries",
  "Contractor fees",
  "Software subscriptions",
  "Hosting and storage",
  "Insurance premiums",
  "Customer acquisition",
  "Facilities and travel",
  "Professional services",
].map((name, at) => ({ name, values: [80 + at * 8, 130 + at * 7, 90 + at * 11, 112 + at * 12] }))
const materials = [
  "Glass bottles",
  "Cardboard boxes",
  "Corrugated paper",
  "Plastic containers",
  "Plastic film",
  "Aluminum cans",
  "Steel cans",
  "Newspaper",
  "Office paper",
  "Clear glass",
  "Mixed glass",
  "Other materials",
]

const compact = [
  {
    id: "t:5",
    box: spot(80, 100, 480, 360),
    chart: { kind: "column", labels: true, categories: quarters, series: budget, unit: "thousand USD" },
  },
  {
    id: "t:6",
    box: spot(720, 100, 480, 360),
    chart: {
      kind: "pie",
      labels: true,
      categories: materials,
      series: [{ name: "Recycling", values: [15, 12, 10, 8, 4, 6, 5, 3, 8, 12, 7, 10] }],
      unit: "kg",
    },
  },
  {
    id: "t:7",
    box: spot(1360, 100, 480, 360),
    chart: { kind: "stacked", labels: true, categories: quarters, series: budget, unit: "thousand USD" },
  },
  {
    id: "t:8",
    box: spot(80, 620, 480, 360),
    chart: {
      kind: "column",
      labels: true,
      categories: quarters,
      series: [{ name: "Revenue", values: [10, 20, 30, 40] }],
      unit: "₹",
    },
  },
]

test("a compact chart keeps its plot, its scale and every name beside a long legend", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await landNodes(
    stack,
    opened,
    compact.map(({ id, box, chart }) => ({ id, type: "frame", parent: opened.slide, props: { box, chart } })),
  )
  const texts = (id: string) => page.locator(`[data-slide-box] [data-node^="${id}#~"]`).filter({ hasText: /\S/ })
  const node = (id: string) => page.locator(`[data-slide-box] [data-node="${id}"]`)
  for (const { id } of compact) {
    await expect(texts(id).first()).toBeVisible()
    expect.soft(await clashesIn(texts(id)), id).toEqual([])
  }
  for (const id of ["t:5", "t:7"]) {
    await expect(page.locator(`[data-slide-box] [data-node^="${id}#~legend:"]`)).toHaveText(
      budget.map(({ name }) => name),
    )
    for (const tick of [`${id}#~tick:0`, `${id}#~unit`]) await expect(node(tick)).toBeVisible()
    for (const [series, { name }] of budget.entries())
      for (const [at, quarter] of quarters.entries()) {
        const mark = await node(`${id}#${String(series)}:${String(at)}`).boundingBox()
        expect.soft(mark?.width ?? 0, `${id} ${name} ${quarter}`).toBeGreaterThan(0.5)
        expect.soft(mark?.height ?? 0, `${id} ${name} ${quarter}`).toBeGreaterThan(0.5)
      }
  }
  await expect(page.locator('[data-slide-box] [data-node^="t:6#~legend:"]')).toHaveText(materials)
  await expect(node("t:6#~unit")).toHaveText("kg")
  const frame = await node("t:6").boundingBox()
  const pie = await node("t:6#0:0").boundingBox()
  expect(pie!.width).toBeGreaterThanOrEqual(frame!.height * 0.4)
  await expect(node("t:8#~tick:0")).toHaveText("₹0")
  await expect(node("t:8#~value:0:3")).toHaveText("₹40")
  await expect(node("t:8#~unit")).toHaveCount(0)
})
