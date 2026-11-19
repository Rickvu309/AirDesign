import { expect, test, type Page } from "@playwright/test"
import { zoomCopy } from "../../apps/web/src/copy/product-copy"
import { colorWords } from "./color-words"
import { clean, entry, openFile, openGrid, manySlides } from "./slide-grid-deck"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test.beforeEach(async ({ page }) => {
  if (process.env.AIRDESIGN_GRID_CPU_RATE !== "4") return
  const device = await page.context().newCDPSession(page)
  await device.send("Emulation.setCPUThrottlingRate", { rate: 4 })
})

async function zoom(page: Page, percent: number) {
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("textbox", { name: zoomCopy.field }).fill(String(percent))
  await page.getByRole("textbox", { name: zoomCopy.field }).press("Enter")
}

for (const [percent, placement] of [
  [53, "above"],
  [23, "above"],
  [14, "inside"],
] as const) {
  test(`${placement} number and hover chrome at ${percent} percent`, async ({ page }) => {
    await openFile(page, { name: "hover.pptx", mimeType: "application/octet-stream", buffer: await manySlides(2) })
    await openGrid(page)
    await zoom(page, percent)
    const card = page.locator("[data-grid-card]").first()
    await expect(card).toHaveAttribute("data-number-placement", placement)
    const slide = entry(page, 1)
    const before = await slide.boundingBox()
    if (placement === "above") {
      const number = (await card.locator("[data-slide-number]").boundingBox())!
      expect(before!.y - number.y).toBeCloseTo(23, 0)
      expect(number.y + number.height).toBeCloseTo(before!.y, 0)
      expect(
        await card
          .locator("[data-grid-halo]")
          .evaluate((element) => getComputedStyle(element, "::before").borderRadius),
      ).toBe(`${(percent * 0.13 + 8).toFixed(2)}px`)
    }
    await slide.hover()
    await expect(card.locator("[data-grid-halo]")).toHaveCSS("opacity", "1")
    expect(await slide.boundingBox()).toEqual(before)
    await expect(slide).toHaveCSS("box-shadow", /2px/)
    await entry(page, 2).hover()
    if (placement === "above") await expect(entry(page, 2)).toHaveCSS("box-shadow", /1px/)
    await slide.hover()
    await page.keyboard.press("Tab")
    await slide.focus()
    await expect(slide).toHaveCSS("outline-style", "solid")
    await page.keyboard.down("Space")
    await expect(card.locator("[data-grid-halo]")).toHaveCSS("opacity", "0")
    await page.keyboard.up("Space")
  })
}

for (const [width, placement] of [
  [76.8, "hidden"],
  [96, "inside"],
] as const) {
  test(`${placement} numbers at ${width} screen pixels`, async ({ page }) => {
    await openFile(page, { name: "overview.pptx", mimeType: "application/octet-stream", buffer: await manySlides(2) })
    await openGrid(page)
    await zoom(page, 10)
    const host = page.locator("[data-grid-viewport]")
    const initial = (await entry(page, 1).boundingBox())!.width
    await host.evaluate(
      (host, delta) => {
        while (delta > 0) {
          const step = Math.min(10, delta)
          host.dispatchEvent(new WheelEvent("wheel", { deltaY: step, ctrlKey: true, bubbles: true, cancelable: true }))
          delta -= step
        }
      },
      Math.log(initial / width) * 100,
    )
    const card = page.locator("[data-grid-card]").first()
    await expect(card).toHaveAttribute("data-number-placement", placement)
    const number = card.locator("[data-slide-number]")
    if (placement === "hidden") await expect(number).toBeHidden()
    else await expect(number).toBeVisible()
    await entry(page, 1).hover()
    await expect(card.locator("[data-grid-halo]")).toHaveCSS("opacity", "1")
    await expect(card.locator("[data-grid-halo]")).toHaveCSS("box-shadow", placement === "hidden" ? /1px/ : /6px/)
    await entry(page, 2).hover()
    if (placement === "hidden")
      await expect(entry(page, 2)).toHaveCSS("box-shadow", "rgb(77, 148, 251) 0px 0px 0px 1px")
  })
}

test("placement waits for a pinch to settle instead of flickering", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  await zoom(page, 29)
  const placements = await page.locator("[data-grid-viewport]").evaluate((host) => {
    const card = host.querySelector("[data-grid-card]")!
    const before = card.getAttribute("data-number-placement")
    for (const deltaY of [10, -10, 10, -10]) {
      host.dispatchEvent(new WheelEvent("wheel", { deltaY, ctrlKey: true, bubbles: true, cancelable: true }))
      if (card.getAttribute("data-number-placement") !== before) return false
    }
    return true
  })
  expect(placements).toBe(true)
})

test("touch never leaves a hover halo", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 1000, height: 800 } })
  const page = await context.newPage()
  await openFile(page, clean)
  await openGrid(page)
  await entry(page, 1).tap()
  await expect(page.locator("[data-grid-halo]").first()).toHaveCSS("opacity", "0")
  await context.close()
})

test("inside numbers stay readable over a dark slide", async ({ page }) => {
  const names = await colorWords("clean.pptx")
  await openFile(page, clean)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page
    .locator("[data-design-panel]")
    .getByRole("button", { name: /^Background color/ })
    .click()
  await page.locator("[data-color-picker]").getByRole("button", { name: names.dk1, exact: true }).click()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await openGrid(page)
  await zoom(page, 15)
  const card = page.locator("[data-grid-card]").first()
  await expect(card.locator("[data-thumb-paint]")).not.toHaveCSS("background-color", "rgb(255, 255, 255)")
  await page.mouse.move(0, 0)
  const number = card.locator("[data-slide-number]")
  await expect(number).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  await expect(number).toHaveCSS("padding", "0px")
  await expect(number).toHaveCSS("-webkit-text-stroke-width", "2px")
  await expect(number).toHaveCSS("paint-order", "stroke")
  await entry(page, 1).hover()
  await expect(card.locator("[data-slide-number]")).toHaveCSS("background-color", "rgb(191, 228, 255)")
})

test("pan and reorder suppress hover, and reduced motion has no halo transition", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  await entry(page, 1).hover()
  const halo = page.locator("[data-grid-halo]").first()
  await expect(halo).toHaveCSS("transition-duration", "0s")
  await page.mouse.down({ button: "middle" })
  await expect(halo).toHaveCSS("opacity", "0")
  await page.mouse.up({ button: "middle" })
  await entry(page, 1).hover()
  await page.locator("[data-slide-number]").first().hover()
  await page.mouse.down()
  await page.mouse.move(700, 400, { steps: 5 })
  await expect(page.locator("[data-drag-ghost]")).toBeVisible()
  await expect(halo).toHaveCSS("opacity", "0")
  await page.keyboard.press("Escape")
  await page.mouse.up()
})

test("element selection, text and element gestures keep hover separate from canvas focus", async ({ page }) => {
  await openFile(page, {
    name: "editing-hover.pptx",
    mimeType: "application/octet-stream",
    buffer: await manySlides(2),
  })
  await openGrid(page)
  await zoom(page, 20)
  const cards = page.locator("[data-grid-card]")
  await cards.first().locator("[data-thumb-node]").first().click({ force: true })
  const live = cards.first().locator("[data-grid-edit]")
  const frame = live.locator("[data-canvas-element]").first()
  await expect(live.locator("[data-selection]")).toBeVisible()
  await frame.hover()
  await expect(cards.first().locator("[data-grid-halo]")).toHaveCSS("opacity", "0")
  await expect(entry(page, 1)).not.toHaveAttribute("data-selected")
  await entry(page, 2).hover()
  await expect(cards.nth(1).locator("[data-grid-halo]")).toHaveCSS("opacity", "1")
  await frame.dblclick()
  await expect(live.locator('[contenteditable="true"]').first()).toBeFocused()
  await expect(cards.first().locator("[data-grid-halo]")).toHaveCSS("opacity", "0")
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-focus-edge]")).toBeFocused()
  await entry(page, 2).hover()
  await expect(cards.nth(1).locator("[data-grid-halo]")).toHaveCSS("opacity", "1")
  await expect(page.locator("[data-grid-viewport]")).toHaveCSS("outline-style", "none")
})

test("inside number tab wins over live content", async ({ page }) => {
  await openFile(page, { name: "tab.pptx", mimeType: "application/octet-stream", buffer: await manySlides(2) })
  await openGrid(page)
  await zoom(page, 20)
  const card = page.locator("[data-grid-card]").first()
  await card.locator("[data-thumb-node]").first().click({ force: true })
  await expect(card.locator("[data-grid-edit]")).toBeVisible()
  await expect(card).toHaveAttribute("data-number-placement", "inside")
  await card.locator("[data-slide-number]").click()
  await expect(entry(page, 1)).toHaveAttribute("data-selected", "")
  await expect(card.locator("[data-grid-edit]")).toHaveCount(0)
})

for (const gesture of ["move", "resize"] as const) {
  test(`element ${gesture} suppresses hover on other slides`, async ({ page }) => {
    await openFile(page, {
      name: "gesture-hover.pptx",
      mimeType: "application/octet-stream",
      buffer: await manySlides(2),
    })
    await openGrid(page)
    await zoom(page, 20)
    const cards = page.locator("[data-grid-card]")
    await cards.first().locator("[data-thumb-node]").first().click({ force: true })
    const live = cards.first().locator("[data-grid-edit]")
    const handle =
      gesture === "move" ? live.locator("[data-canvas-element]").first() : live.locator('[data-grip="bottom-right"]')
    await handle.hover()
    await page.mouse.down()
    const other = (await entry(page, 2).boundingBox())!
    await page.mouse.move(other.x + other.width / 2, other.y + other.height / 2, { steps: 5 })
    for (const halo of await cards.locator("[data-grid-halo]").all()) await expect(halo).toHaveCSS("opacity", "0")
    for (const add of await cards.locator("[data-add-gap]").all()) await expect(add).toBeHidden()
    await page.mouse.up()
  })
}

test("Escape closes an open slide menu before clearing slide selection", async ({ page }) => {
  await openFile(page, clean)
  await openGrid(page)
  const slide = entry(page, 1)
  await slide.click({ button: "right" })
  await expect(page.getByRole("menu")).toBeVisible()
  await slide.focus()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toBeHidden()
  await expect(slide).toBeFocused()
  await expect(slide).toHaveAttribute("data-selected", "")
})

for (const percent of [9, 53, 200]) {
  test(`slide and selection share the scaled corner at ${percent}%`, async ({ page }) => {
    await openFile(page, clean)
    await openGrid(page)
    await zoom(page, percent)
    const card = page.locator("[data-grid-card]").first()
    const radius = Math.max(2, (13 * percent) / 100)
    await expect(entry(page, 1)).toHaveCSS("border-radius", `${radius}px`)
    await expect(card.locator("[data-grid-halo]")).toHaveCSS("border-radius", `${radius}px`)
    await expect(card.locator("[data-thumb-paint]")).toHaveCSS("border-radius", `${radius}px`)
    await entry(page, 1).focus()
    await page.keyboard.press("Enter")
    await expect(card.locator("[data-grid-edit]")).toBeVisible()
    await expect(card.locator("[data-slide-paint]")).toHaveCSS("border-radius", `${radius}px`)
    await expect(entry(page, 1)).toHaveCSS("border-radius", `${radius}px`)
  })
}
