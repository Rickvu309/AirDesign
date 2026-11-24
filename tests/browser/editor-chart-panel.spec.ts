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
  rows = categories,
  value = (at: number, row: number) => series[at]!.values[row]!,
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
        chart: {
          kind: "column",
          categories: rows,
          series: series.map((each, at) => ({ ...each, values: rows.map((_, row) => value(at, row)) })),
        },
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

test("a category's column grows to its longest word up to a cap, so a word that fits never breaks and a long one never covers a value", async ({
  page,
  context,
  stack,
}) => {
  const data = await chartData(
    page,
    context,
    stack,
    ["Current days outstanding", "Q4 target", "x".repeat(80)],
    () => 52,
  )
  const fields = data.locator("textarea")
  const fits = await fields.first().evaluate((field) => {
    const style = getComputedStyle(field)
    const pen = document.createElement("canvas").getContext("2d")!
    pen.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const room = field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    return { word: pen.measureText("outstanding").width, room }
  })
  expect(fits.word).toBeLessThanOrEqual(fits.room)
  const cell = await data
    .locator("[class*=sticky]")
    .first()
    .evaluate((sticky) => sticky.getBoundingClientRect().width)
  expect(cell).toBeLessThanOrEqual(8 * 16 + 1)

  await data.evaluate((scroller) => {
    scroller.scrollLeft = scroller.scrollWidth
  })
  const sticky = await data
    .locator("[class*=sticky]")
    .nth(2)
    .evaluate((cell) => cell.getBoundingClientRect().right)
  const lastValue = data.getByLabel("5", { exact: true }).nth(2)
  const box = await lastValue.evaluate((field) => field.getBoundingClientRect().toJSON())
  expect(box.left).toBeGreaterThanOrEqual(sticky)
  await expect(lastValue).toBeVisible()
})

test("a normal word in a category never breaks mid-word, even when a wide value shares its row at the default panel width", async ({
  page,
  context,
  stack,
}) => {
  const data = await chartData(page, context, stack, ["Days sales outstanding", "Q4 target"], (at, row) =>
    at === 0 && row === 0 ? 123456789.12 : 52,
  )
  const panel = await data.evaluate((scroller) => scroller.clientWidth)
  expect(panel).toBeLessThanOrEqual(212)
  const room = await data
    .locator("textarea")
    .first()
    .evaluate((field) => {
      const style = getComputedStyle(field)
      const pen = document.createElement("canvas").getContext("2d")!
      pen.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const space = field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      return { word: pen.measureText("outstanding").width, space }
    })
  expect(room.word).toBeLessThanOrEqual(room.space)
  await expect(data.getByLabel("1", { exact: true }).first()).toHaveValue("123456789.12")
  const reach = await data.evaluate((scroller) => scroller.scrollWidth - scroller.clientWidth)
  expect(reach).toBeGreaterThan(0)
})
