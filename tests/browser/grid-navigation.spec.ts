import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { zoomCopy } from "../../apps/web/src/copy/product-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { expect } from "@playwright/test"
import { covers } from "./gesture"
import { clean, entry, openGrid, manySlides } from "./slide-grid-deck"
import { test } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("Space drag pans over a focused slide with a grab cursor, without picking the slide or scrolling", async ({
  page,
  decks,
}) => {
  await decks.open({ name: "seven.pptx", mimeType: "application/octet-stream", buffer: await manySlides(7) })
  await openGrid(page)
  await entry(page, 1).focus()
  const second = (await entry(page, 2).boundingBox())!
  await page.keyboard.down("Space")
  await expect(page.locator("[data-grid-viewport]")).toHaveCSS("cursor", "grab")
  await expect(entry(page, 2)).toHaveCSS("cursor", "grab")
  await page.mouse.move(second.x + 20, second.y + 20)
  await page.mouse.down()
  await page.mouse.move(second.x + 100, second.y + 60, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up("Space")
  expect((await entry(page, 2).boundingBox())!.x).toBeCloseTo(second.x + 80, 0)
  expect((await entry(page, 2).boundingBox())!.y).toBeCloseTo(second.y + 40, 0)
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 1)).toBeFocused()
  await expect(page.locator("[data-grid-viewport]")).not.toHaveCSS("cursor", "grab")
  expect(await page.evaluate(() => [scrollX, scrollY, document.scrollingElement?.scrollTop ?? 0])).toEqual([0, 0, 0])
})

test("Space types a space into a grid text box being edited and does not pan", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  await page.locator("[data-grid-card] [data-thumb-node]").first().dblclick({ force: true })
  const text = page.locator('[data-grid-edit] [contenteditable="true"]').first()
  await page.keyboard.press("End")
  const before = (await entry(page, 1).boundingBox())!
  await page.keyboard.type(" there")
  await expect(text).toContainText("Hello there")
  await expect(page.locator("[data-grid-viewport]")).not.toHaveCSS("cursor", "grab")
  expect((await entry(page, 1).boundingBox())!.x).toBeCloseTo(before.x, 0)
})

test("Space and arrows reach the show when Present starts from the grid", async ({ page, decks }) => {
  await decks.open({ name: "seven.pptx", mimeType: "application/octet-stream", buffer: await manySlides(7) })
  await openGrid(page)
  await page.getByRole("button", { name: presentCopy.present, exact: true }).click()
  const slide = page.locator("[data-present-show] [data-present-slide]")
  await expect(slide).toHaveAttribute("data-present-slide", "1")
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await page.keyboard.press("Space")
  await expect(slide).toHaveAttribute("data-present-slide", "2")
  await page.keyboard.press("ArrowRight")
  await expect(slide).toHaveAttribute("data-present-slide", "3")
})

test("Shift+2 fills the canvas with the selected slide and Shift+1 fits the deck, both in the shared menu", async ({
  page,
  decks,
}) => {
  covers("zoom-fit", "zoom-selection")
  await decks.open({ name: "seven.pptx", mimeType: "application/octet-stream", buffer: await manySlides(7) })
  await openGrid(page)
  const host = (await page.locator("[data-grid-viewport]").boundingBox())!
  await entry(page, 7).click()
  await page.keyboard.press("Shift+Digit2")
  const seventh = (await entry(page, 7).boundingBox())!
  expect(Math.max(host.width - seventh.width, host.height - seventh.height)).toBeGreaterThanOrEqual(96)
  expect(Math.min(host.width - seventh.width, host.height - seventh.height)).toBeLessThan(200)
  await expect(entry(page, 6)).not.toBeInViewport({ ratio: 0.1 })
  await page.keyboard.press("Shift+Digit1")
  for (const number of [1, 7]) await expect(entry(page, number)).toBeInViewport()
  await page.locator("[data-zoom-readout]").click()
  await expect(page.getByRole("menuitemradio", { name: zoomCopy.fit })).toBeChecked()
  await expect(page.getByRole("menuitemradio", { name: zoomCopy.fit })).toHaveAttribute(
    "aria-keyshortcuts",
    zoomCopy.fitKey,
  )
  await page.getByRole("menuitem", { name: zoomCopy.selection }).click()
  expect((await entry(page, 7).boundingBox())!.width).toBeCloseTo(seventh.width, 0)
})

test("Shift+1 and Shift+2 leave typed digits alone in a grid text box", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  await page.locator("[data-grid-card] [data-thumb-node]").first().dblclick({ force: true })
  const text = page.locator('[data-grid-edit] [contenteditable="true"]').first()
  await page.keyboard.press("End")
  const before = (await entry(page, 1).boundingBox())!
  await page.keyboard.press("Shift+Digit1")
  await page.keyboard.press("Shift+Digit2")
  await expect(text).toContainText(/Hello[1!][2@]/)
  expect((await entry(page, 1).boundingBox())!.width).toBeCloseTo(before.width, 0)
})

test("pinch paints immediately and writes storage once after thirty events", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  const host = page.locator("[data-grid-viewport]")
  const pinched = await host.evaluate(async (host) => {
    const seen = { writes: 0, changes: 0, stop: () => undefined as void }
    Object.assign(window, { pinchSeen: seen })
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      seen.writes++
      original.call(this, key, value)
    }
    const world = host.querySelector('[role="group"]')!
    const observer = new MutationObserver((records) => {
      seen.changes += records.filter((record) => record.target !== world).length
    })
    observer.observe(world, { subtree: true, attributes: true, childList: true, characterData: true })
    seen.stop = () => {
      observer.disconnect()
      Storage.prototype.setItem = original
    }
    const before = world.getAttribute("style")
    for (let n = 0; n < 30; n++)
      host.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -1,
          ctrlKey: true,
          clientX: 700,
          clientY: 400,
          bubbles: true,
          cancelable: true,
        }),
      )
    await Promise.resolve()
    const transform = world.getAttribute("style")
    return { during: seen.writes, rendered: seen.changes, moved: before !== transform, transform }
  })
  await decks.ready()
  const after = await host.evaluate((host, transform) => {
    const seen = (window as unknown as { pinchSeen: { writes: number; stop: () => void } }).pinchSeen
    seen.stop()
    return { after: seen.writes, stable: transform === host.querySelector('[role="group"]')!.getAttribute("style") }
  }, pinched.transform)
  expect({ ...pinched, ...after, transform: undefined }).toEqual({
    during: 0,
    after: 1,
    moved: true,
    rendered: 0,
    stable: true,
    transform: undefined,
  })
})

test("Shift wheel and arrows with no slide focused pan, while focused arrows move between slides", async ({
  page,
  decks,
}) => {
  covers("pan-arrows")
  await decks.open({ name: "seven.pptx", mimeType: "application/octet-stream", buffer: await manySlides(7) })
  await openGrid(page)
  const host = page.locator("[data-grid-viewport]")
  const first = (await entry(page, 1).boundingBox())!
  await host.dispatchEvent("wheel", { deltaY: 80, shiftKey: true })
  expect((await entry(page, 1).boundingBox())!.x).toBeCloseTo(first.x - 80, 0)
  await host.click({ position: { x: 10, y: 10 } })
  await page.keyboard.press("ArrowRight")
  expect((await entry(page, 1).boundingBox())!.x).toBeCloseTo(first.x - 160, 0)
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await page.keyboard.press("ArrowDown")
  expect((await entry(page, 1).boundingBox())!.y).toBeCloseTo(first.y - 80, 0)
  await entry(page, 1).focus()
  const focused = (await entry(page, 1).boundingBox())!
  await page.keyboard.press("ArrowRight")
  await expect(entry(page, 2)).toBeFocused()
  expect((await entry(page, 1).boundingBox())!.y).toBeCloseTo(focused.y, 0)
})

test("fifty-slide fit keeps proportional gaps and readable numbers", async ({ page, decks }) => {
  await decks.open({ name: "fifty.pptx", mimeType: "application/octet-stream", buffer: await manySlides(50) })
  await openGrid(page)
  const first = (await entry(page, 1).boundingBox())!
  const second = (await entry(page, 2).boundingBox())!
  expect((second.x - first.x - first.width) / first.width).toBeCloseTo(0.13, 2)
  await expect(page.locator("[data-slide-number]").last()).toBeVisible()
  const number = (await page.locator("[data-slide-number]").nth(9).boundingBox())!
  expect(number.y).toBeGreaterThan(first.y + first.height + 4)
})

test("remembers pan and zoom through Slides and reload", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  const host = page.locator("[data-grid-viewport]")
  await host.dispatchEvent("wheel", { deltaY: -40, ctrlKey: true, clientX: 300, clientY: 300 })
  await host.dispatchEvent("wheel", { deltaX: 160, deltaY: 170 })
  await decks.ready()
  const before = (await entry(page, 1).boundingBox())!
  const percent = await page.locator("[data-zoom-readout]").textContent()
  await page.getByRole("button", { name: slideListCopy.listName, exact: true }).click()
  await openGrid(page)
  expect((await entry(page, 1).boundingBox())!).toEqual(before)
  await page.reload()
  await decks.ready()
  await openGrid(page)
  expect((await entry(page, 1).boundingBox())!).toEqual(before)
  await expect(page.locator("[data-zoom-readout]")).toHaveText(percent!)
})

test("a deck left at Zoom to fit reopens at Zoom to fit after a pan is fitted away", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  const fitted = (await entry(page, 1).boundingBox())!
  await page.locator("[data-grid-viewport]").dispatchEvent("wheel", { deltaX: 300, deltaY: 200 })
  await decks.ready()
  await page.keyboard.press("Shift+Digit1")
  await page.reload()
  await decks.ready()
  await openGrid(page)
  expect((await entry(page, 1).boundingBox())!).toEqual(fitted)
  await page.locator("[data-zoom-readout]").click()
  await expect(page.getByRole("menuitemradio", { name: zoomCopy.fit })).toBeChecked()
})

test("a pinch that settles stays where it was pinched, with another slide selected off screen", async ({
  page,
  decks,
}) => {
  await decks.open({ name: "seven.pptx", mimeType: "application/octet-stream", buffer: await manySlides(7) })
  await openGrid(page)
  await entry(page, 7).click()
  const first = (await entry(page, 1).boundingBox())!
  const host = page.locator("[data-grid-viewport]")
  for (let n = 0; n < 12; n++)
    await host.dispatchEvent("wheel", { deltaY: -10, ctrlKey: true, clientX: first.x + 10, clientY: first.y + 10 })
  await expect(entry(page, 7)).not.toBeInViewport()
  const pinched = (await entry(page, 1).boundingBox())!
  await decks.ready()
  expect((await entry(page, 1).boundingBox())!.x).toBeCloseTo(pinched.x, 0)
  expect((await entry(page, 1).boundingBox())!.y).toBeCloseTo(pinched.y, 0)
})

test("H hand and middle-button drag still pan over slides", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  for (const button of ["left", "middle"] as const) {
    if (button === "left") await page.keyboard.press("h")
    else await page.keyboard.press("v")
    const box = (await entry(page, 1).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down({ button })
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 4 })
    await page.mouse.up({ button })
    expect((await entry(page, 1).boundingBox())!.x).toBeCloseTo(box.x + 60, 0)
  }
})

test("Space pans before a restored canvas has keyboard focus", async ({ page, decks }) => {
  await decks.open(clean)
  await openGrid(page)
  await page.locator("[data-grid-viewport]").dispatchEvent("wheel", { deltaY: 40 })
  await decks.ready()
  await page.reload()
  await decks.ready()
  await openGrid(page)
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  const box = (await entry(page, 1).boundingBox())!
  await page.keyboard.down("Space")
  await expect(page.locator("[data-grid-viewport]")).toHaveCSS("cursor", "grab")
  await page.mouse.move(box.x + 10, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x + 50, box.y + 10, { steps: 3 })
  await page.mouse.up()
  await page.keyboard.up("Space")
  expect((await entry(page, 1).boundingBox())!.x).toBeCloseTo(box.x + 40, 0)
})

test("slide numbers sit above the slide and Grid draws no section heading", async ({ page, decks }) => {
  await decks.open("scripts/pptx-fixtures/sections-before.pptx")
  await openGrid(page)
  await expect(page.locator("[data-editor-grid]").getByRole("heading", { name: "Opening" })).toHaveCount(0)
  await expect(page.locator("[data-slide-group]").first()).toHaveAccessibleName("Opening")
  const number = await page.locator("[data-slide-number]").first().boundingBox()
  const slide = await entry(page, 1).boundingBox()
  if (number === null || slide === null) throw new Error("bounds")
  expect(number.y + number.height).toBeLessThanOrEqual(slide.y + 1)
})
