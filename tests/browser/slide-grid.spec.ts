import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { zoomCopy, zoomToOf } from "../../apps/web/src/copy/product-copy"
import {
  clean,
  entry,
  fifty,
  fixtures,
  manySlides,
  mark,
  openFile,
  openGrid,
  sectioned,
  settled,
} from "./slide-grid-deck"

const hundred = 100

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

async function ringed(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement
    if (!(el instanceof HTMLElement)) return false
    const probe = document.createElement("span")
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue("--focus-ring")
    document.body.append(probe)
    const ring = getComputedStyle(probe).color
    probe.remove()
    const style = getComputedStyle(el)
    return style.outlineStyle === "solid" && style.outlineWidth === "3px" && style.outlineColor === ring
  })
}

test("a selected slide has one frame that follows its thumbnail corners", async ({ page }) => {
  await openFile(page, sectioned)
  await openGrid(page)
  const selected = entry(page, 1)
  const thumb = selected.locator("[data-slide-thumb]")
  const radius = await thumb.evaluate((element) => getComputedStyle(element).borderRadius)
  await expect(selected).toHaveCSS("border-radius", radius)
  await expect(thumb).toHaveCSS("box-shadow", "none")
  await expect(selected).not.toHaveCSS("box-shadow", "none")
  await selected.focus()
  await page.keyboard.press("ArrowRight")
  await expect(entry(page, 2)).toBeFocused()
  expect(await ringed(page)).toBe(true)
})

test("the grid shows every slide, and the keyboard opens one", async ({ page }) => {
  await openFile(page, sectioned)
  await openGrid(page)
  const groups = page.locator("[data-editor-grid] [data-slide-group]")
  await expect(groups).toHaveCount(2)
  await expect(groups.nth(0)).toHaveAccessibleName("Opening")
  await expect(groups.nth(1)).toHaveAccessibleName("Numbers")
  await expect(page.locator("[data-editor-grid]").getByRole("heading", { name: "Opening" })).toHaveCount(0)
  await expect(page.locator("[data-editor-grid]").getByRole("heading", { name: "Numbers" })).toHaveCount(0)
  await expect(entry(page, 1)).toHaveAccessibleName("Slide 1 of 2")
  await expect(entry(page, 2)).toHaveAccessibleName("Slide 2 of 2")
  await expect(page.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "true")
  const motions = await page
    .locator("[data-editor-grid]")
    .evaluate((root) =>
      root.getAnimations({ subtree: true }).map((animation) => animation.effect?.getComputedTiming().duration ?? 0),
    )
  expect(motions.filter((duration) => duration !== 0)).toEqual([])
  await entry(page, 1).focus()
  await page.keyboard.press("ArrowRight")
  await expect(entry(page, 2)).toBeFocused()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  expect(await ringed(page)).toBe(true)
  await page.keyboard.press("ArrowDown")
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("ArrowUp")
  await expect(entry(page, 1)).toBeFocused()
  await page.keyboard.press("End")
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("Home")
  await expect(entry(page, 1)).toBeFocused()
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-grid-edit]")).toHaveCount(1)
  await expect(page.locator("[data-slide-paint]")).toBeVisible()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await openGrid(page)
  await page.getByRole("button", { name: "Slides" }).click()
  await expect(page.locator("[data-editor-grid]")).toHaveCount(0)
  await expect(page.locator("[data-editor-sidebar]")).toBeVisible()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
})

test("the grid adds, reorders, duplicates and deletes a slide without a mouse", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  const said = page.locator("[data-editor-grid] [data-announcer]")
  const plus = page.locator('[aria-label="Add slide after slide 1"]')
  await expect(plus.locator("[data-add-mark]")).toHaveCSS("width", "8px")
  await entry(page, 1).hover()
  await expect(plus).toBeVisible()
  await plus.click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(said).toHaveText("Added slide 2")
  await page.getByRole("button", { name: "New slide", exact: true }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(said).toHaveText("Added slide 3")
  await expect(entry(page, 3)).toBeFocused()
  await page.keyboard.press("Alt+ArrowLeft")
  await expect(said).toHaveText("Moved slide 3 to position 2")
  await expect(entry(page, 2)).toBeFocused()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await page.keyboard.press("Alt+ArrowRight")
  await expect(said).toHaveText("Moved slide 2 to position 3")
  await expect(entry(page, 3)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+d")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(4)
  await expect(said).toHaveText("Duplicated slide 3. The copy is slide 4")
  await expect(entry(page, 4)).toBeFocused()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(said).toHaveText("Slide 4 deleted")
  await page.keyboard.press("Home")
  await page.keyboard.press("Delete")
  await page.keyboard.press("Delete")
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect(entry(page, 1)).toHaveAccessibleName("Slide 1 of 1")
})

test("a right click or the menu key on a slide offers the slide commands, and each one does what the keyboard does", async ({
  page,
}) => {
  await openFile(page, sectioned)
  await openGrid(page)
  const said = page.locator("[data-editor-grid] [data-announcer]")
  const menu = page.getByRole("menu")
  await entry(page, 1).click({ button: "right" })
  await expect(menu).toBeVisible()
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await expect(menu.getByRole("menuitem")).toHaveText([
    /^Open/,
    /^Duplicate/,
    /^Delete/,
    /^Move up/,
    /^Move down/,
    slideListCopy.skip,
    slideListCopy.addAfterMenu,
    slideListCopy.addBelowMenu,
    slideListCopy.moveBelowMenu,
  ])
  await expect(menu.getByRole("menuitem", { name: /^Move up/ })).toHaveAttribute("aria-disabled", "true")
  await menu.getByRole("menuitem", { name: /^Duplicate/ }).click()
  await expect(menu).toBeHidden()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(said).toHaveText("Duplicated slide 1. The copy is slide 2")
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("Shift+F10")
  await expect(menu).toBeVisible()
  await expect(menu.getByRole("menuitem", { name: /^Move down/ })).not.toHaveAttribute("aria-disabled", "true")
  await menu.getByRole("menuitem", { name: /^Move down/ }).click()
  await expect(said).toHaveText("Moved slide 2 to position 3")
  await expect(entry(page, 3)).toBeFocused()
  await entry(page, 3).click({ button: "right" })
  await menu.getByRole("menuitem", { name: /^Delete/ }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(said).toHaveText("Slide 3 deleted")
  await entry(page, 2).click({ button: "right" })
  await expect(menu).toBeVisible()
  await entry(page, 2).focus()
  await page.keyboard.press("Escape")
  await expect(menu).toBeHidden()
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("ContextMenu")
  await menu.getByRole("menuitem", { name: /^Open/ }).click()
  await expect(page.locator("[data-grid-edit]")).toHaveCount(1)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
})

test("Escape closes the slide menu while focus is still on its slide", async ({ page }) => {
  await openFile(page, sectioned)
  await openGrid(page)
  await entry(page, 2).click({ button: "right" })
  const menu = page.getByRole("menu")
  await expect(menu).toBeVisible()
  await entry(page, 2).focus()
  await page.keyboard.press("Escape")
  await expect(menu).toBeHidden()
  await expect(entry(page, 2)).toBeFocused()
})

async function dragOnto(
  page: Page,
  from: number,
  to: number,
  side: "left" | "right",
  place: number | null,
): Promise<void> {
  const source = await entry(page, from).boundingBox()
  const target = await entry(page, to).boundingBox()
  if (source === null || target === null) throw new Error("no slide to drag")
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  const x = side === "left" ? target.x + target.width * 0.2 : target.x + target.width * 0.8
  await page.mouse.move(x, target.y + target.height / 2, { steps: 8 })
  const bar = page.locator("[data-drop-bar]")
  if (place === null) {
    await expect(bar).toBeHidden()
    await page.mouse.up()
    return
  }
  await expect(bar).toBeVisible()
  await expect(bar).toHaveAttribute("data-drop-place", String(place))
  const mark = await bar.boundingBox()
  const gap = side === "left" ? target.x - (mark?.x ?? 0) : (mark?.x ?? 0) - (target.x + target.width)
  expect(gap).toBeGreaterThan(0)
  expect(gap).toBeLessThan(target.width * 0.13)
  await expect(entry(page, from)).toHaveCSS("opacity", "0.4")
  await expect(page.locator(`[aria-label="Add slide after slide ${String(from)}"]`)).toBeHidden()
  await page.mouse.up()
  await expect(bar).toBeHidden()
}

test("a slide dragged onto half of another lands on that side of it, where the drop bar showed", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  const said = page.locator("[data-editor-grid] [data-announcer]")
  for (const count of [2, 3, 4]) {
    await page.getByRole("button", { name: "New slide", exact: true }).click()
    await expect(page.locator("[data-slide-entry]")).toHaveCount(count)
  }
  await dragOnto(page, 1, 3, "right", 4)
  await expect(said).toHaveText("Moved slide 1 to position 3")
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await dragOnto(page, 3, 1, "left", 1)
  await expect(said).toHaveText("Moved slide 3 to position 1")
  await expect(entry(page, 1)).toBeFocused()
  await expect(entry(page, 1)).toContainText("Hello")
  await dragOnto(page, 2, 3, "left", null)
  await expect(said).toHaveText("Moved slide 3 to position 1")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(4)
})

test("a slide dropped at the start of a section's line shows there and joins that section at its start", async ({
  page,
}) => {
  await openFile(page, join(fixtures, "sections-after.pptx"))
  await openGrid(page)
  const groups = page.locator("[data-editor-grid] [data-slide-group]")
  await expect(groups.nth(0)).toHaveAccessibleName("Opening")
  await expect(groups.nth(1)).toHaveAccessibleName("Numbers")
  expect(await groupCounts(page)).toEqual([1, 2])
  const source = await entry(page, 3).boundingBox()
  const target = await entry(page, 2).boundingBox()
  const previous = await entry(page, 1).boundingBox()
  if (source === null || target === null || previous === null) throw new Error("no slide to drag")
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width * 0.2, target.y + target.height / 2, { steps: 8 })
  const bar = page.locator("[data-drop-bar]")
  await expect(bar).toHaveAttribute("data-drop-place", "2")
  const mark = await bar.boundingBox()
  expect(Math.abs((mark?.y ?? 0) - target.y)).toBeLessThan(2)
  expect(target.x - (mark?.x ?? 0)).toBeGreaterThan(0)
  expect(target.x - (mark?.x ?? 0)).toBeLessThan(target.width * 0.13)
  expect(previous.y).toBeLessThan(target.y)
  await page.mouse.up()
  await expect(page.locator("[data-editor-grid] [data-announcer]")).toHaveText("Moved slide 3 to position 2")
  await expect(groups.nth(0)).toHaveAccessibleName("Opening")
  await expect(groups.nth(1)).toHaveAccessibleName("Numbers")
  expect(await groupCounts(page)).toEqual([1, 2])
})

async function groupCounts(page: Page): Promise<number[]> {
  return page.locator("[data-editor-grid] [data-grid-group-member]").evaluateAll((nodes) => {
    const counts = new Map<string, number>()
    for (const node of nodes) {
      const start = node.getAttribute("data-grid-group-member")
      if (start === null) continue
      const slides = node.querySelectorAll("[data-slide-entry]").length
      if (slides === 0) continue
      counts.set(start, (counts.get(start) ?? 0) + slides)
    }
    return [...counts.keys()].sort((left, right) => Number(left) - Number(right)).map((key) => counts.get(key) ?? 0)
  })
}

test("a 50-slide deck paints grid thumbnails as they come into view", async ({ page }) => {
  test.setTimeout(120_000)
  await openFile(page, {
    name: "fifty.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(fifty),
  })
  await openGrid(page)
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemradio", { name: zoomToOf(50), exact: true }).click()
  await expect(page.locator("[data-editor-grid] [data-slide-entry]")).toHaveCount(fifty)
  await expect(page.locator("[data-editor-grid] [data-slide-thumb]")).toHaveCount(fifty)
  await expect.poll(async () => page.locator("[data-editor-grid] [data-thumb-paint]").count()).toBeGreaterThan(0)
  const painted = await page.locator("[data-editor-grid] [data-thumb-paint]").count()
  expect(painted, `painted ${painted} thumbs`).toBeLessThan(fifty)
  const list = await page.locator("[data-editor-grid] [data-slide-list]").innerText()
  expect(list).toContain(mark(1, fifty))
  expect(list).not.toContain(mark(fifty, fifty))
})

async function perRow(page: Page): Promise<number> {
  return page.locator("[data-editor-grid] [data-slide-entry]").evaluateAll((entries) => {
    const tops = entries.map((entry) => Math.round(entry.getBoundingClientRect().top))
    return tops.filter((top) => top === tops[0]).length
  })
}

async function percent(page: Page): Promise<number> {
  return Number.parseInt((await page.locator("[data-zoom-readout]").textContent()) ?? "", 10)
}

async function thumbWidth(page: Page): Promise<number> {
  return page
    .locator('[data-editor-grid] [data-slide-entry="1"]')
    .evaluate((entry) => Math.round(entry.getBoundingClientRect().width))
}

test("the grid fits the deck by default, zooms by percent with the keyboard and the menu, and keeps the zoom for the deck", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openFile(page, {
    name: "fifty.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(fifty),
  })
  await openGrid(page)
  expect(await perRow(page)).toBe(9)
  const room = await page.locator("[data-grid-viewport]").boundingBox()
  const last = await entry(page, 50).boundingBox()
  expect(last!.y + last!.height).toBeLessThan(room!.y + room!.height)
  const fit = await percent(page)
  await entry(page, 1).focus()
  await page.keyboard.press("ControlOrMeta+Equal")
  await expect.poll(() => percent(page)).toBe(25)
  expect(await thumbWidth(page)).toBe(320)
  await expect.poll(() => perRow(page)).toBe(9)
  await page.keyboard.press("ControlOrMeta+Minus")
  await expect.poll(() => percent(page)).toBe(10)
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemradio", { name: zoomToOf(50), exact: true }).click()
  await expect(page.locator("[data-zoom-readout]")).toHaveText("50%")
  expect(await thumbWidth(page)).toBe(640)
  await expect.poll(() => perRow(page)).toBe(9)
  await page.reload()
  await settled(page)
  await openGrid(page)
  await expect(page.locator("[data-zoom-readout]")).toHaveText("50%")
  await expect.poll(() => perRow(page)).toBe(9)
  await entry(page, 1).focus()
  await page.keyboard.press("Shift+Digit1")
  await expect.poll(() => percent(page)).toBe(fit)
  await expect.poll(() => perRow(page)).toBe(9)
})

test("Zoom to fit shows every slide of a short deck as large as the window allows", async ({ page }) => {
  await openFile(page, sectioned)
  await openGrid(page)
  const room = await page.locator("[data-grid-viewport]").boundingBox()
  for (const number of [1, 2]) {
    const card = await entry(page, number).boundingBox()
    expect(card!.x).toBeGreaterThanOrEqual(room!.x)
    expect(card!.y).toBeGreaterThanOrEqual(room!.y)
    expect(card!.x + card!.width).toBeLessThanOrEqual(room!.x + room!.width)
    expect(card!.y + card!.height).toBeLessThanOrEqual(room!.y + room!.height)
  }
  expect(await thumbWidth(page)).toBeGreaterThan(300)
})

async function zoomMenuOf(page: Page) {
  await page.locator("[data-zoom-readout]").click()
  const menu = page.getByRole("menu")
  await expect(page.getByRole("textbox", { name: zoomCopy.field })).toBeFocused()
  const rows = await menu.locator("[role=menuitem], [role=menuitemradio]").allTextContents()
  const trigger = await page.locator("[data-zoom-readout]").boundingBox()
  const popup = await menu.boundingBox()
  await page.keyboard.press("Escape")
  await expect(menu).toHaveCount(0)
  return {
    rows,
    rightEdge: Math.round((popup?.x ?? 0) + (popup?.width ?? 0) - (trigger?.x ?? 0) - (trigger?.width ?? 0)),
    below: (popup?.y ?? 0) > (trigger?.y ?? 0) + (trigger?.height ?? 0),
  }
}

test("the slide view and the grid open the same zoom menu, hung from the zoom button's right edge", async ({
  page,
}) => {
  await openFile(page, sectioned)
  const slides = await zoomMenuOf(page)
  await openGrid(page)
  const grid = await zoomMenuOf(page)
  expect(grid).toEqual({
    ...slides,
    rows: [...slides.rows.slice(0, 2), `${zoomCopy.selection}${zoomCopy.selectionKey}`, ...slides.rows.slice(2)],
  })
  expect(slides.rows).toHaveLength(6)
  expect(slides.rightEdge).toBe(0)
  expect(slides.below).toBe(true)
  await expect(page.locator("[data-view-bar] button")).toHaveText([/^\d+%$/, "", "Export"])
  await expect(page.locator("[data-view-bar] [data-present-button]")).toHaveAccessibleName(presentCopy.present)
  await expect(page.locator("[data-view-bar] [data-present-button]")).toHaveText("")
})

test("Present in the grid starts the show from the focused slide and lands back in the grid", async ({ page }) => {
  await openFile(page, sectioned)
  await openGrid(page)
  await entry(page, 2).focus()
  await page.getByRole("button", { name: presentCopy.present, exact: true }).click()
  await expect(page.locator("[data-present-show]")).toBeVisible()
  await expect(page.locator("[data-present-show] [data-present-slide]")).toHaveAttribute("data-present-slide", "2")
  await expect(page.locator("[data-editor-grid]")).toHaveAttribute("inert", "")
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-present-show]")).toHaveCount(0)
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
})

test("a 100-slide deck is refused before it opens", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "hundred.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(hundred),
  })
  await expect(page.getByText("This deck has more than 50 slides")).toBeVisible()
  await expect(page).toHaveURL("/")
})
