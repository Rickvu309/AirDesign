import { expect, type Page } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { test } from "./api-stack"
import { clickSlide, landNodes, openEditor, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const categories = ["Q1", "Q2", "Q3", "Q4"]
const series = ["Plan", "Actual", "Forecast", "Units", "Churn"].map((name, at) => ({
  name,
  values: categories.map((_, row) => (at === 4 && row === 0 ? 123456789.12 : 1000 * at + row * 7.25 + 3021.75)),
}))

async function chartData(
  page: Page,
  context: Parameters<typeof openEditor>[1],
  stack: Parameters<typeof openEditor>[2],
) {
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "frame",
      parent: opened.slide,
      props: {
        name: editorCopy.chart,
        box: spot(1100, 700, 600, 260),
        chart: { kind: "column", categories, series },
      },
    },
  ])
  await clickSlide(page, 1300, 850)
  const data = page.locator("[data-chart-data]")
  await expect(data).toBeVisible()
  return data
}

test("a chart's data shows every value in full, and the category stays at the left edge while the values scroll", async ({
  page,
  context,
  stack,
}) => {
  const data = await chartData(page, context, stack)
  await expect(data.getByLabel("1", { exact: true }).first()).toHaveValue("3021.75")
  const clipped = await data
    .locator("input")
    .evaluateAll((fields) => fields.filter((field) => field.scrollWidth > field.clientWidth).length)
  expect(clipped).toBe(0)

  const reach = await data.evaluate((scroller) => {
    scroller.scrollLeft = scroller.scrollWidth
    return scroller.scrollLeft
  })
  expect(reach).toBeGreaterThan(0)
  const edges = await data.evaluate((scroller) => {
    const cell = scroller
      .querySelector("textarea, input:not([title])")!
      .closest("[class*=sticky]")!
      .getBoundingClientRect()
    return { cell: cell.left, scroller: scroller.getBoundingClientRect().left }
  })
  expect(Math.abs(edges.cell - edges.scroller)).toBeLessThan(4)

  const sticky = await data
    .locator("[class*=sticky]")
    .first()
    .evaluate((cell) => cell.getBoundingClientRect().right)
  const lastValue = data.getByLabel("5", { exact: true }).first()
  const box = await lastValue.evaluate((field) => field.getBoundingClientRect().toJSON())
  const scrollerRight = await data.evaluate((scroller) => scroller.getBoundingClientRect().right)
  const last = { sticky, left: box.left, right: box.right, scroller: scrollerRight }
  expect(last.left).toBeGreaterThanOrEqual(last.sticky)
  expect(last.right).toBeLessThanOrEqual(last.scroller)
  await expect(lastValue).toHaveValue("123456789.12")
})
