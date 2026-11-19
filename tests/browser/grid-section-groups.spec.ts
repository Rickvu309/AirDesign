import { expect } from "@playwright/test"
import { forward, test } from "./api-stack"
import { boxOf, openSaved } from "./grid-reorder-deck"
import { entry, openGrid, groupNumbers, settled } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("a sectioned import keeps its first-slide slide group starts in Fit, on the first edit, and in a second tab", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 6, true)
  const initial = [
    [1, 2, 3],
    [4, 5, 6],
  ]
  await expect.poll(() => groupNumbers(page)).toEqual(initial)
  await expect.poll(saved.rows).toEqual([saved.ids.slice(0, 3), saved.ids.slice(3)])
  for (const [index, name] of ["Opening", "Results"].entries()) {
    const group = page.locator(`[data-slide-group="${index * 3}"]`)
    await expect(group).toHaveAccessibleName(name)
    await expect(entry(page, index * 3 + 1)).toBeVisible()
  }
  const beforeFit = await boxOf(page, 6)
  await page.keyboard.press("ControlOrMeta+0")
  expect(await boxOf(page, 6)).toEqual(beforeFit)

  const second = await context.newPage()
  await forward(second, stack)
  await second.goto(page.url())
  await settled(second)
  await openGrid(second)
  await expect.poll(() => groupNumbers(second)).toEqual(initial)
  const { deckRoutes } = await import("../../packages/catalog/src/index.ts")
  const before = (await stack.post(deckRoutes.open.path, { deck: saved.deck }, saved.cookie)).json
  expect(before.register).toMatchObject({ order: [] })
  await entry(page, 2).focus()
  await page.keyboard.press("ControlOrMeta+d")
  const edited = [
    [1, 2, 3, 4],
    [5, 6, 7],
  ]
  await expect.poll(() => groupNumbers(page)).toEqual(edited)
  await expect.poll(() => groupNumbers(second)).toEqual(edited)
  const after = await saved.order()
  await expect.poll(saved.rows).toEqual([after.slice(0, 4), saved.ids.slice(3)])
  expect(after.filter((id) => saved.ids.includes(id))).toEqual(saved.ids)
  await expect
    .poll(async () => (await stack.post(deckRoutes.open.path, { deck: saved.deck }, saved.cookie)).json.register)
    .toMatchObject({ order: [{ slide: "clone", grid: 3 }] })
  await page.reload()
  await settled(page)
  await openGrid(page)
  await expect.poll(() => groupNumbers(page)).toEqual(edited)
})

test("an unsectioned import of six slides is one slide group in the browser and for agents, drawn as four and two", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 6)
  await expect.poll(() => groupNumbers(page)).toEqual([[1, 2, 3, 4, 5, 6]])
  await expect(page.locator("[data-group-head]")).toHaveCount(0)
  await expect(page.locator("[data-group-handle]")).toHaveCount(1)
  await expect.poll(saved.rows).toEqual([saved.ids])
  await expect(page.locator("[data-zoom-readout]")).toHaveText("23%")
  const tops = await Promise.all([1, 2, 3, 4, 5, 6].map(async (number) => Math.round((await boxOf(page, number)).y)))
  expect(new Set(tops.slice(0, 4)).size).toBe(1)
  expect(new Set(tops.slice(4)).size).toBe(1)
  expect(tops[4]).toBeGreaterThan(tops[0]!)
  await expect(page.locator("[data-group-rule]")).toHaveCount(0)
  await expect(page.locator("[data-slide-group]")).toHaveCount(1)
})
