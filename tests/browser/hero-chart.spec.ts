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

test.use({ viewport: { width: 1440, height: 1000 } })

test("the hero chart draws once, lands its annotation and leaves the heading still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto(site.origin)
  await page.evaluate(() => document.fonts.ready)
  const chart = page.locator(".hero-chart-draw")
  await expect(chart).toHaveCount(1)
  const heading = page.getByRole("heading", { level: 1 })
  const before = await heading.boundingBox()
  const frames = await chart.evaluate((node) => {
    const animation = node.getAnimations()[0]
    if (!animation) throw new Error("chart did not animate")
    animation.pause()
    animation.currentTime = 0
    const start = getComputedStyle(node).clipPath
    animation.currentTime = 600
    const middle = getComputedStyle(node).clipPath
    animation.finish()
    return { start, middle, end: getComputedStyle(node).clipPath, iterations: animation.effect?.getTiming().iterations }
  })
  expect(frames.start).toBe("inset(0px 100% 0px 0px)")
  expect(frames.middle).not.toBe(frames.start)
  expect(frames.middle).not.toBe(frames.end)
  expect(frames.end).toBe("inset(0px 0% 0px 0px)")
  expect(frames.iterations).toBe(1)
  await page.locator(".hero-chart-annotation").evaluateAll((nodes) => {
    for (const node of nodes) for (const animation of node.getAnimations()) animation.finish()
  })
  await expect(page.locator(".hero-chart-pill")).toHaveCSS("opacity", "1")
  await expect(page.locator(".hero-chart-pill")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)")
  await expect(page.locator(".hero-chart-ring")).toHaveCSS("opacity", "0.35")
  expect(await heading.boundingBox()).toEqual(before)
  expect(await heading.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0)
})

test("reduced motion shows the finished hero chart without animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(site.origin)
  await expect(page.locator(".hero-chart-draw")).toHaveCSS("clip-path", "none")
  await expect(page.locator(".hero-chart-pill")).toHaveCSS("opacity", "1")
  await expect(page.locator(".hero-chart-pill")).toHaveCSS("transform", "none")
  await expect(page.locator(".hero-chart-ring")).toHaveCSS("opacity", "0.35")
  expect(
    await page
      .locator("section")
      .first()
      .evaluate((node) => node.getAnimations({ subtree: true }).length),
  ).toBe(0)
})
