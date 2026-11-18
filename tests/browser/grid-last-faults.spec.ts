import { expect, type Page } from "@playwright/test"
import { limits } from "../../packages/document/src/index.ts"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test, type Stack } from "./api-stack"
import { boxOf, canvas, hover, openSaved, panOf, roomOf, zoomTo, type Saved } from "./grid-reorder-deck"
import { entry, fixtures } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

const cards = (page: Page) => page.locator("[data-editor-grid] [data-slide-entry]")
const toolbarDesign = (page: Page) => page.getByRole("button", { name: "Design", exact: true })
const addBelow = (page: Page) => page.getByRole("button", { name: slideListCopy.addBelow(1), exact: true })
const addAfter = (page: Page) => page.getByRole("button", { name: slideListCopy.addAfter(1), exact: true })
const readout = (page: Page) => page.locator("[data-zoom-readout]")
const liveElement = (page: Page) => page.locator("[data-grid-edit] [data-canvas-element]").first()
const menuItem = (page: Page, name: string) => page.getByRole("menuitem", { name, exact: true })
const menuAfter = slideListCopy.addAfterMenu
const menuBelow = slideListCopy.addBelowMenu
const menuMove = slideListCopy.moveBelowMenu

async function revision(stack: Stack, { deck, cookie }: Saved): Promise<number> {
  const { deckRoutes } = await import("../../packages/catalog/src/index.ts")
  return Number((await stack.post(deckRoutes.open.path, { deck }, cookie)).json.revision)
}

async function focusMeasure(page: Page) {
  const focused = await page.evaluate(() => ({
    slide: document.activeElement?.getAttribute("data-slide-entry"),
    tag: document.activeElement?.tagName,
    visible: document.activeElement?.matches(":focus-visible"),
  }))
  const selected = await cards(page).evaluateAll((entries) =>
    (
      entries.find((entry) => entry.hasAttribute("data-selected")) ??
      entries.find((entry) => entry.getAttribute("aria-current") === "true")
    )?.getAttribute("data-slide-entry"),
  )
  return { ...focused, selected }
}

test("a drop with unchanged slide order saves new row membership and undoes once", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 7)
  await addBelow(page).focus()
  await page.keyboard.press("Enter")
  await expect.poll(saved.rows).toHaveLength(3)
  const before = await saved.rows()
  const start = await revision(stack, saved)
  await zoomTo(page, 15)
  const number = (index: number) => page.locator("[data-slide-number]").nth(index - 1)
  await number(6).click()
  await number(7).click({ modifiers: ["ControlOrMeta"] })
  const original = await entry(page, 6).elementHandle()
  const source = (await number(6).boundingBox())!
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await hover(page, 5, 0.78)
  const bar = page.locator("[data-drop-bar]")
  await expect(bar).toBeVisible()
  await page.mouse.up()
  await expect
    .poll(async () => ({ revision: await revision(stack, saved), rows: await saved.rows() }))
    .toEqual({
      revision: start + 1,
      rows: [before[0], [...before[1]!, ...before[2]!.slice(0, 2)], before[2]!.slice(2)],
    })
  expect(await original?.evaluate((node) => node === document.querySelector('[data-slide-entry="6"]'))).toBe(true)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved.rows).toEqual(before)
  expect(await revision(stack, saved)).toBe(start + 2)
})

for (const target of ["element", "slide"] as const) {
  test(`Design keeps the working ${target} in view at the same zoom`, async ({ page, context, stack }) => {
    await openSaved(page, context, stack, 7)
    if (target === "element") {
      await entry(page, 1).press("Enter")
      await liveElement(page).click()
      await page.keyboard.press("Shift+2")
    } else {
      await zoomTo(page, 50)
      await page.locator("[data-slide-number]").nth(3).click()
      const [box, room] = await Promise.all([boxOf(page, 4), roomOf(page)])
      await canvas(page).dispatchEvent("wheel", { deltaX: box.x + box.width - (room.x + room.width - 34.8) })
    }
    const working = target === "element" ? liveElement(page) : entry(page, 4)
    const before = (await working.boundingBox())!
    const beforeRoom = await roomOf(page)
    const zoom = await readout(page).textContent()
    expect(before.x + before.width).toBeLessThanOrEqual(beforeRoom.x + beforeRoom.width)
    expect(before.x).toBeGreaterThanOrEqual(beforeRoom.x)
    expect(before.y).toBeGreaterThanOrEqual(beforeRoom.y)
    expect(before.y + before.height).toBeLessThanOrEqual(beforeRoom.y + beforeRoom.height)
    await toolbarDesign(page).click()
    const room = await roomOf(page)
    const after = (await working.boundingBox())!
    const x = before.width > room.width ? room.x : Math.min(before.x, room.x + room.width - before.width)
    expect(after.x).toBeCloseTo(x, 0)
    expect(after.y).toBeCloseTo(before.y, 1)
    expect(after.width).toBeCloseTo(before.width, 1)
    await expect(readout(page)).toHaveText(zoom ?? "")
  })
}

test("five slide Undos and Redos focus the restored selection", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, 7)
  const before = await saved.rows()
  const start = await revision(stack, saved)
  await entry(page, 1).focus()
  await page.keyboard.press("Tab")
  await expect(addAfter(page)).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(cards(page)).toHaveCount(8)
  await addBelow(page).focus()
  await page.keyboard.press("Enter")
  await expect(cards(page)).toHaveCount(9)
  await page.keyboard.press("Home")
  await page.keyboard.press("Shift+ArrowRight")
  await page.keyboard.press("Shift+ArrowRight")
  await page.keyboard.press("Alt+ArrowDown")
  await expect.poll(() => revision(stack, saved)).toBe(start + 3)
  await page.keyboard.press("ControlOrMeta+d")
  await expect(cards(page)).toHaveCount(12)
  await page.keyboard.press("Delete")
  await expect(cards(page)).toHaveCount(9)
  await expect.poll(() => revision(stack, saved)).toBe(start + 5)
  const misplaced = []
  for (const [index, count] of [12, 9, 9, 8, 7, 8, 9, 9, 12, 9].entries()) {
    await page.keyboard.press(index < 5 ? "ControlOrMeta+z" : "ControlOrMeta+Shift+z")
    await expect.poll(() => revision(stack, saved)).toBe(start + 6 + index)
    await expect(cards(page)).toHaveCount(count)
    if (index === 4) expect(await saved.rows()).toEqual(before)
    const focus = await focusMeasure(page)
    if (focus.slide !== focus.selected || !focus.visible) misplaced.push({ index, ...focus })
    if (focus.slide !== null) await expect(entry(page, Number(focus.slide))).toBeInViewport()
  }
  expect(misplaced).toEqual([])
})

for (const path of [slideListCopy.deleteKey, "menu"] as const) {
  test(`last slide deletion explains the refusal via ${path}`, async ({ page, context, stack }) => {
    const saved = await openSaved(page, context, stack, 1)
    await entry(page, 1).focus()
    if (path === "menu") {
      await page.keyboard.press("ContextMenu")
      await page.getByRole("menuitem", { name: new RegExp(slideListCopy.delete) }).click({ timeout: 1200 })
    } else await page.keyboard.press(path)
    await expect(page.getByText(slideListCopy.lastSlide, { exact: true }).first()).toBeVisible()
    expect(await revision(stack, saved)).toBe(0)
  })
}

test("context menu inserts relative to its slide and moves the selection into a new row at low zoom", async ({
  page,
  context,
  stack,
}) => {
  const saved = await openSaved(page, context, stack, 7)
  const before = await saved.rows()
  const start = await revision(stack, saved)
  await zoomTo(page, 8)
  await expect(page.locator("[data-add-gap], [data-add-row]")).toHaveCount(0)
  await entry(page, 2).click({ button: "right" })
  await menuItem(page, menuAfter).click()
  await expect.poll(saved.order).toHaveLength(8)
  const first = await saved.order()
  expect(first.filter((id) => saved.ids.includes(id))).toEqual(saved.ids)
  const added = first[2]!
  expect(saved.ids).not.toContain(added)
  await expect.poll(saved.rows).toEqual([[...before[0]!.slice(0, 2), added, ...before[0]!.slice(2)], before[1]])

  await entry(page, 2).press("ContextMenu")
  await menuItem(page, menuBelow).click()
  await expect.poll(saved.rows).toHaveLength(3)
  const rows = await saved.rows()
  expect(rows.map((row) => row.length)).toEqual([5, 1, 3])

  await entry(page, 2).click()
  await entry(page, 4).click({ modifiers: ["ControlOrMeta"] })
  await entry(page, 2).press("Shift+F10")
  await menuItem(page, menuMove).click()
  const source = rows[0]!
  await expect.poll(saved.rows).toEqual([[source[0], source[2], source[4]], [source[1], source[3]], ...rows.slice(1)])
  expect(await revision(stack, saved)).toBe(start + 3)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(saved.rows).toEqual(rows)
  expect(await revision(stack, saved)).toBe(start + 4)
  await expect(readout(page)).toHaveText(/8%/)
})

test("context menu describes the slide limit at Fit", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, limits.slides)
  await entry(page, 1).press("ContextMenu")
  for (const name of [menuAfter, menuBelow]) {
    const item = menuItem(page, name)
    await expect(item).toBeDisabled()
    await expect(item).toHaveAccessibleDescription(slideListCopy.addLimit(limits.slides))
  }
  expect(await revision(stack, saved)).toBe(0)
})

for (const control of ["Design", "zoom"] as const) {
  test(`Escape from ${control} returns selection to the canvas`, async ({ page, context, stack }) => {
    await openSaved(page, context, stack, `${fixtures}/clean.pptx`)
    await zoomTo(page, 20)
    await entry(page, 1).press("Enter")
    await liveElement(page).click()
    if (control === "Design") {
      await toolbarDesign(page).click()
      await toolbarDesign(page).click()
    } else await readout(page).focus()
    await expect(page.locator("[data-grid-edit] [data-selection]").first()).toBeVisible()
    const before = await panOf(page)
    await page.keyboard.press("Escape")
    await expect(page.locator("[data-grid-edit]")).toHaveCount(0)
    await expect(entry(page, 1)).toHaveAttribute("data-selected", "")
    await expect(page.locator("[data-focus-edge]")).toBeFocused()
    expect(await panOf(page)).toEqual(before)
  })
}

test("Undo opens the collapsed section holding the first selected slide", async ({ page, context, stack }) => {
  const saved = await openSaved(page, context, stack, `${fixtures}/sections-after.pptx`)
  await entry(page, 3).press("ContextMenu")
  await menuItem(page, menuAfter).click()
  await expect(cards(page)).toHaveCount(4)
  const opening = page.locator("[data-section-head]").first()
  await opening.press(slideListCopy.openKey)
  await expect(entry(page, 1)).toHaveCount(0)
  await entry(page, 4).press("ControlOrMeta+a")
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => revision(stack, saved)).toBe(2)
  await expect(opening).toHaveAttribute("aria-expanded", "true")
  await expect(entry(page, 1)).toBeFocused()
  await expect(entry(page, 1)).toBeInViewport()
})
