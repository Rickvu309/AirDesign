import { expect, type Page } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { forward, signInBrowser, test } from "./api-stack"

async function usageGrowth(page: Page, side: ReturnType<Page["locator"]>) {
  await page.evaluate((name) => {
    delete document.body.dataset.usageGrowth
    function record(box: Element) {
      const seen = box.getAnimations().flatMap((animation) => {
        if (!(animation instanceof CSSTransition)) return []
        const timing = animation.effect?.getTiming()
        return [
          {
            property: animation.transitionProperty,
            duration: Number(timing?.duration),
            easing: String(timing?.easing),
          },
        ]
      })
      document.body.dataset.usageGrowth = JSON.stringify(seen)
    }
    const observer = new MutationObserver(() => {
      const box = document.querySelector(`[role="dialog"][aria-label="${name}"]`)
      if (box === null) return
      record(box)
      if (box.getAnimations().length > 0 || matchMedia("(prefers-reduced-motion: reduce)").matches)
        observer.disconnect()
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-starting-style"],
    })
  }, productCopy.usageTitle)
  await side.getByRole("button", { name: productCopy.usageTitle }).click()
  await expect(page.getByRole("dialog", { name: productCopy.usageTitle })).toBeVisible()
  await page.waitForFunction(() => {
    const seen = JSON.parse(document.body.dataset.usageGrowth ?? "[]")
    return seen.length > 0 || matchMedia("(prefers-reduced-motion: reduce)").matches
  })
  return page.evaluate(() => JSON.parse(document.body.dataset.usageGrowth ?? "[]"))
}

test("the usage popover grows from its ring on the micro curve, holds still with reduced motion, and closes on Escape or a press outside", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/s")
  await page.locator("[data-editor-ready]").waitFor()
  const side = page.locator("[data-editor-panel]")
  const ring = side.getByRole("button", { name: productCopy.usageTitle })
  const grown = await usageGrowth(page, side)
  const micro = "cubic-bezier(0.22, 1, 0.36, 1)"
  expect(grown).toEqual([
    { property: "opacity", duration: 150, easing: micro },
    { property: "scale", duration: 150, easing: micro },
  ])
  const origin = await page
    .getByRole("dialog", { name: productCopy.usageTitle })
    .evaluate((box) => ({ actual: getComputedStyle(box).transformOrigin, expected: `${box.clientWidth}px -8px` }))
  expect(origin.actual).toBe(origin.expected)
  await ring.click()
  await expect(page.getByRole("dialog", { name: productCopy.usageTitle })).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: "reduce" })
  expect(await usageGrowth(page, side)).toEqual([])
  await expect(page.getByRole("dialog", { name: productCopy.usageTitle })).toHaveCSS("opacity", "1")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: productCopy.usageTitle })).toHaveCount(0)
  await expect(ring).toBeFocused()
  await ring.click()
  await page
    .locator("[data-slide-paint]")
    .first()
    .click({ position: { x: 4, y: 4 } })
  await expect(page.getByRole("dialog", { name: productCopy.usageTitle })).toHaveCount(0)
})
