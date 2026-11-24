import { expect, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
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

test("a chart's data shows every value in full once the values scroll into view", async ({ page, context, stack }) => {
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
  const lastValue = data.getByLabel("5", { exact: true }).first()
  const box = await lastValue.evaluate((field) => field.getBoundingClientRect().toJSON())
  const scroller = await data.evaluate((each) => each.getBoundingClientRect().toJSON())
  expect(box.left).toBeGreaterThanOrEqual(scroller.left)
  expect(box.right).toBeLessThanOrEqual(scroller.right)
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
    .locator("[data-chart-category]")
    .first()
    .evaluate((sticky) => sticky.getBoundingClientRect().width)
  expect(cell).toBeLessThanOrEqual(8 * 16 + 1)

  await data.evaluate((scroller) => {
    scroller.scrollLeft = scroller.scrollWidth
  })
  const lastValue = data.getByLabel("5", { exact: true }).nth(2)
  const box = await lastValue.evaluate((field) => field.getBoundingClientRect().toJSON())
  const scroller = await data.evaluate((each) => each.getBoundingClientRect().toJSON())
  expect(box.left).toBeGreaterThanOrEqual(scroller.left)
  expect(box.right).toBeLessThanOrEqual(scroller.right)
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

test("at the narrowest panel, scrolling the values shows every digit of the widest value, and a category keeps its whole words", async ({
  page,
  context,
  stack,
}) => {
  const data = await chartData(page, context, stack, ["Days sales outstanding", "Q4 target"], (at, row) =>
    at === 0 && row === 0 ? 123456789.12 : 52,
  )
  await page.getByRole("separator", { name: designCopy.resizePanel }).focus()
  await page.keyboard.press("Home")
  await expect(page.getByRole("separator", { name: designCopy.resizePanel })).toHaveAttribute("aria-valuenow", "220")

  const room = await data
    .locator("textarea")
    .first()
    .evaluate((field) => {
      const style = getComputedStyle(field)
      const pen = document.createElement("canvas").getContext("2d")!
      pen.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      return {
        word: pen.measureText("outstanding").width,
        space: field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      }
    })
  expect(room.word).toBeLessThanOrEqual(room.space)

  const widest = data.getByLabel("1", { exact: true }).first()
  await expect(widest).toHaveValue("123456789.12")
  await widest.scrollIntoViewIfNeeded()
  const seen = await widest.evaluate((field) => {
    const scroller = field.closest("[data-chart-data]")!.getBoundingClientRect()
    const box = field.getBoundingClientRect()
    const input = field as HTMLInputElement
    return {
      inside: box.left >= scroller.left && box.right <= scroller.right,
      clipped: input.scrollWidth > input.clientWidth,
    }
  })
  expect(seen).toEqual({ inside: true, clipped: false })
})
