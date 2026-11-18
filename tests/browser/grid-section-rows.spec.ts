import { expect } from "@playwright/test"
import { forward, test } from "./api-stack"
import { boxOf, openSaved } from "./grid-reorder-deck"
import { entry, openGrid, rowNumbers, settled } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("a sectioned import keeps its first-slide row starts in Fit, on the first edit, and in a second tab", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 6, true)
  const initial = [
    [1, 2, 3],
    [4, 5, 6],
  ]
  await expect.poll(() => rowNumbers(page)).toEqual(initial)
  await expect.poll(saved.rows).toEqual([saved.ids.slice(0, 3), saved.ids.slice(3)])
  for (const [index, name] of ["Opening", "Results"].entries()) {
    const row = page.locator(`[data-grid-row-member="${index * 3}"]`)
    const heading = row.getByRole("button", { name: new RegExp(name) })
    await expect(heading).toBeInViewport()
    const bounds = await heading.boundingBox()
    const slide = await boxOf(page, index * 3 + 1)
    expect(bounds!.x).toBeCloseTo(slide.x, 0)
    expect(bounds!.y).toBeLessThan(slide.y)
  }
  const beforeFit = await boxOf(page, 6)
  await page.keyboard.press("ControlOrMeta+0")
  expect(await boxOf(page, 6)).toEqual(beforeFit)

  const second = await context.newPage()
  await forward(second, stack)
  await second.goto(page.url())
  await settled(second)
  await openGrid(second)
  await expect.poll(() => rowNumbers(second)).toEqual(initial)
  const { deckRoutes } = await import("../../packages/catalog/src/index.ts")
  const before = (await stack.post(deckRoutes.open.path, { deck: saved.deck }, saved.cookie)).json
  expect(before.register).toMatchObject({ order: [] })
  await entry(page, 2).focus()
  await page.keyboard.press("ControlOrMeta+d")
  const edited = [
    [1, 2, 3, 4],
    [5, 6, 7],
  ]
  await expect.poll(() => rowNumbers(page)).toEqual(edited)
  await expect.poll(() => rowNumbers(second)).toEqual(edited)
  const after = await saved.order()
  await expect.poll(saved.rows).toEqual([after.slice(0, 4), saved.ids.slice(3)])
  expect(after.filter((id) => saved.ids.includes(id))).toEqual(saved.ids)
  await expect
    .poll(async () => (await stack.post(deckRoutes.open.path, { deck: saved.deck }, saved.cookie)).json.register)
    .toMatchObject({ order: [{ slide: "clone", grid: 2 }] })
  await page.reload()
  await settled(page)
  await openGrid(page)
  await expect.poll(() => rowNumbers(page)).toEqual(edited)
})

test("an unsectioned import keeps the same browser and MCP row partition", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 6)
  await expect
    .poll(() => rowNumbers(page))
    .toEqual([
      [1, 2, 3, 4],
      [5, 6],
    ])
  await expect(page.locator("[data-section-head]")).toHaveCount(0)
  await expect.poll(saved.rows).toEqual([saved.ids.slice(0, 4), saved.ids.slice(4)])
})
