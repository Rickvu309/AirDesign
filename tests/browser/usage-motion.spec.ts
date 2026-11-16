import { expect, type Page } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { forward, openClean, signInBrowser, test } from "./api-stack"

async function usageGrowth(page: Page, side: ReturnType<Page["locator"]>) {
  await page.evaluate(() => {
    const seen: { property: string; duration: number; easing: string }[] = []
    document.body.dataset.usageGrowth = "[]"
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const added of record.addedNodes) {
          if (!(added instanceof HTMLElement) || added.getAttribute("role") !== "region") continue
          observer.disconnect()
          for (const animation of added.getAnimations()) {
            if (!(animation instanceof CSSTransition)) continue
            const timing = animation.effect?.getTiming()
            seen.push({
              property: animation.transitionProperty,
              duration: Number(timing?.duration),
              easing: String(timing?.easing),
            })
          }
          document.body.dataset.usageGrowth = JSON.stringify(seen)
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
  await side.getByRole("button", { name: productCopy.usageTitle }).click()
  await expect(side.getByRole("region", { name: productCopy.usageTitle })).toBeVisible()
  return page.evaluate(() => JSON.parse(document.body.dataset.usageGrowth ?? "[]"))
}

test("the usage popover grows from its ring on the micro curve, and holds still with reduced motion", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await openClean(page)
  const side = page.locator("[data-editor-panel]")
  const ring = side.getByRole("button", { name: productCopy.usageTitle })
  const grown = await usageGrowth(page, side)
  const micro = "cubic-bezier(0.22, 1, 0.36, 1)"
  expect(grown).toEqual([
    { property: "opacity", duration: 150, easing: micro },
    { property: "scale", duration: 150, easing: micro },
  ])
  const origin = await side
    .getByRole("region", { name: productCopy.usageTitle })
    .evaluate((box) => ({ actual: getComputedStyle(box).transformOrigin, expected: `${box.clientWidth}px 0px` }))
  expect(origin.actual).toBe(origin.expected)
  await ring.click()
  await expect(side.getByRole("region", { name: productCopy.usageTitle })).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: "reduce" })
  expect(await usageGrowth(page, side)).toEqual([])
  await expect(side.getByRole("region", { name: productCopy.usageTitle })).toHaveCSS("opacity", "1")
  await page.keyboard.press("Escape")
  await expect(side.getByRole("region", { name: productCopy.usageTitle })).toHaveCount(0)
})
