import { expect } from "@playwright/test"
import { test } from "./deck-test"
import { serveSite, type ServedSite } from "./site-server.ts"

let site: ServedSite

test.beforeAll(async () => {
  site = await serveSite()
})

test.afterAll(async () => {
  await site.close()
})

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "no-preference" })

test("the nav pill moves for as long as the panel token says", async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("readystatechange", () => {
      document.documentElement.style.setProperty("--ease-panel", "500ms cubic-bezier(0.32, 0.72, 0, 1)")
    })
    const durations: number[] = []
    Object.assign(window, { pillDurations: durations })
    const animate = Element.prototype.animate
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
      if (this.hasAttribute("data-nav-pill") && typeof args[1] === "object") {
        durations.push(Number(args[1].duration))
      }
      return animate.apply(this, args)
    }
  })
  await page.goto(site.origin)
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole("link", { name: "Agents" }).first().click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "pillDurations") as number[])).not.toEqual([])
  const durations = await page.evaluate(() => Reflect.get(window, "pillDurations") as number[])
  expect(new Set(durations)).toEqual(new Set([500]))
})
