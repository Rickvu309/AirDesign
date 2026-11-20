import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { shapeCopy } from "../../apps/web/src/copy/shape-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { expect, type Locator } from "@playwright/test"
import { test } from "./deck-test"
import { store } from "./home-store.ts"
import { newBlankDeck } from "./new-deck.ts"

test.use({ viewport: { width: 1600, height: 1000 } })

const strongEaseOut = "cubic-bezier(0.22, 1, 0.36, 1)"

function motion(popup: Locator) {
  return popup.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      animation: style.animationName,
      property: style.transitionProperty,
      duration: style.transitionDuration,
      curve: style.transitionTimingFunction,
    }
  })
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await store(page, [])
  await page.goto("/")
})

test("a menu opened by a pointer grows from its trigger on the strong ease-out curve", async ({ page }) => {
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
  const menu = page.getByRole("menu", { name: productCopy.newDeck })
  await expect(menu).toBeVisible()
  await expect(menu).not.toHaveAttribute("data-instant")
  expect(await motion(menu)).toMatchObject({
    animation: "none",
    property: "opacity, scale",
    duration: "0.15s",
    curve: strongEaseOut,
  })
})

test("a menu opened with Enter and closed with Escape does not move", async ({ page }) => {
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).focus()
  await page.keyboard.press(slideListCopy.openKey)
  const menu = page.getByRole("menu", { name: productCopy.newDeck })
  await expect(menu).toBeVisible()
  await expect(menu).toHaveAttribute("data-instant", "click")
  expect(await motion(menu)).toMatchObject({ animation: "none", property: "none" })
  expect(await menu.evaluate((element) => element.getAnimations().length)).toBe(0)
  await menu.evaluate((element) => {
    const seen: { instant: string | null; property: string; animations: number }[] = []
    Object.assign(window, { closing: seen })
    new MutationObserver(() => {
      if (!element.hasAttribute("data-closed")) return
      seen.push({
        instant: element.getAttribute("data-instant"),
        property: getComputedStyle(element).transitionProperty,
        animations: element.getAnimations().length,
      })
    }).observe(element, { attributes: true })
  })
  await page.keyboard.press("Escape")
  await expect(menu).toHaveCount(0)
  const closing = await page.evaluate(
    () =>
      (window as unknown as { closing: { instant: string | null; property: string; animations: number }[] }).closing,
  )
  expect(closing.length).toBeGreaterThan(0)
  expect(closing.every((step) => step.instant === "dismiss" && step.property === "none" && step.animations === 0)).toBe(
    true,
  )
})

test("editor menus and popovers that pass duration-0 open without motion", async ({ page, decks }) => {
  await newBlankDeck(page)
  await decks.ready()
  await page.locator("[data-zoom-readout]").click()
  const zoom = page.getByRole("menu").filter({ has: page.getByRole("menuitemradio", { name: "Zoom to 100%" }) })
  await expect(zoom).toBeVisible()
  expect(await motion(zoom)).toMatchObject({ animation: "none", property: "opacity, scale", duration: "0s" })
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  const shapes = page.locator('[data-slot="popover-content"]')
  await expect(shapes).toBeVisible()
  expect(await motion(shapes)).toMatchObject({ animation: "none", duration: "0s" })
  expect(await shapes.evaluate((element) => element.getAnimations().length)).toBe(0)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).focus()
  await page.keyboard.press(slideListCopy.openKey)
  await expect(shapes).toBeVisible()
  expect(await motion(shapes)).toMatchObject({ animation: "none", duration: "0s" })
  expect(await shapes.evaluate((element) => element.getAnimations().length)).toBe(0)
})
