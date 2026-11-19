import { expect } from "@playwright/test"
import { forward, test } from "./api-stack"
import { boxOf, grab, hover, openSaved, panOf, roomOf, zoomTo } from "./grid-reorder-deck"
import { entry, openGrid, groupNumbers, settled, groupSizes } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("slide group start drops follow the pointer, save across tabs and reload, and undo once", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 8, groupSizes(8))
  const before = await saved.rows()
  expect(before).toEqual([saved.ids.slice(0, 4), saved.ids.slice(4)])
  await zoomTo(page, 20)
  const bar = page.locator("[data-drop-bar]")

  await test.step("prepend a single slide to the second row", async () => {
    await grab(page, 1)
    await hover(page, 5, 0.2)
    await expect(bar).toBeVisible()
    const mark = await bar.boundingBox()
    const target = await boxOf(page, 5)
    if (mark === null) throw new Error("drop bar")
    expect.soft(mark.y).toBeCloseTo(target.y, 0)
    expect.soft(mark.x + mark.width).toBeLessThan(target.x)
    await page.mouse.up()
    await expect.poll(saved.rows).toEqual([saved.ids.slice(1, 4), [saved.ids[0], ...saved.ids.slice(4)]])
    await page.keyboard.press("ControlOrMeta+z")
    await expect.poll(saved.rows).toEqual(before)
  })

  const second = await context.newPage()
  await forward(second, stack)
  await second.goto(page.url())
  await settled(second)
  await openGrid(second)
  await expect
    .poll(() => groupNumbers(second))
    .toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ])
  await page.bringToFront()

  await test.step("prepend the previous row end with slide order unchanged", async () => {
    await grab(page, 4)
    await hover(page, 5, 0.2)
    await expect(bar).toBeVisible()
    await page.mouse.up()
    await expect.poll(saved.rows).toEqual([saved.ids.slice(0, 3), saved.ids.slice(3)])
    expect(await saved.order()).toEqual(saved.ids)
    await expect
      .poll(() => groupNumbers(second))
      .toEqual([
        [1, 2, 3],
        [4, 5, 6, 7, 8],
      ])
    await page.reload()
    await settled(page)
    await openGrid(page)
    await expect
      .poll(() => groupNumbers(page))
      .toEqual([
        [1, 2, 3],
        [4, 5, 6, 7, 8],
      ])
  })

  await test.step("prepend a selection to the first row and undo the group once", async () => {
    await entry(page, 5).click()
    await entry(page, 7).click({ modifiers: ["ControlOrMeta"] })
    await grab(page, 5)
    await hover(page, 1, 0.2)
    await expect(bar).toBeVisible()
    const mark = await bar.boundingBox()
    const target = await boxOf(page, 1)
    if (mark === null) throw new Error("drop bar")
    expect(mark.y).toBeCloseTo(target.y, 0)
    expect(mark.x + mark.width).toBeLessThan(target.x)
    await page.mouse.up()
    const [a, b, c, d, e, f, g, h] = saved.ids
    await expect.poll(saved.rows).toEqual([
      [e, g, a, b, c],
      [d, f, h],
    ])
    await page.keyboard.press("ControlOrMeta+z")
    await expect.poll(saved.rows).toEqual([
      [a, b, c],
      [d, e, f, g, h],
    ])
  })

  await test.step("append at the row-end half of the same gap", async () => {
    await grab(page, 4)
    await hover(page, 3, 0.8)
    await expect(bar).toBeVisible()
    const target = await boxOf(page, 3)
    await page.mouse.move(target.x + target.width + 5, target.y + target.height / 2)
    await expect(bar).toBeVisible()
    const mark = await bar.boundingBox()
    if (mark === null) throw new Error("drop bar")
    expect(mark.y).toBeCloseTo(target.y, 0)
    expect(mark.x).toBeGreaterThan(target.x + target.width)
    await page.mouse.up()
    await expect.poll(saved.rows).toEqual(before)
  })

  await second.close()

  await test.step("keep the row-start bar aligned while the pointer edge pans", async () => {
    await zoomTo(page, 50)
    await entry(page, 1).focus()
    await grab(page, 1)
    const room = await roomOf(page)
    const first = await boxOf(page, 1)
    const origin = await panOf(page)
    await page.mouse.move(first.x + first.width * 0.2, room.y + room.height - 24)
    await expect
      .poll(
        async () => {
          const [pan, mark, target] = await Promise.all([panOf(page), bar.boundingBox(), boxOf(page, 5)])
          return pan.y < origin.y && mark !== null && Math.abs(mark.y - target.y) < 1 && mark.x + mark.width < target.x
        },
        { intervals: [16] },
      )
      .toBe(true)
    await page.keyboard.press("Escape")
    await page.mouse.up()
    await expect(bar).toBeHidden()
    expect(await saved.rows()).toEqual(before)
  })

  await test.step("prepend on a fresh sectioned deck without changing its opening layout rules", async () => {
    const sectioned = await openSaved(page, context, stack, 6, true)
    await expect.poll(sectioned.rows).toEqual([sectioned.ids.slice(0, 3), sectioned.ids.slice(3)])
    await zoomTo(page, 20)
    await grab(page, 3)
    await hover(page, 4, 0.2)
    await expect(bar).toBeVisible()
    await page.mouse.up()
    await expect.poll(sectioned.rows).toEqual([sectioned.ids.slice(0, 2), sectioned.ids.slice(2)])
    const { deckRoutes } = await import("../../packages/catalog/src/index.ts")
    const { json } = await stack.post(deckRoutes.open.path, { deck: sectioned.deck }, sectioned.cookie)
    expect(json.register).toMatchObject({ order: [{ slide: "move-many", grid: 3, row: "before" }] })
    await page.keyboard.press("ControlOrMeta+z")
    await expect.poll(sectioned.rows).toEqual([sectioned.ids.slice(0, 3), sectioned.ids.slice(3)])
  })
})
