import { expect, test, type Page } from "@playwright/test"
import { serveSite, type ServedSite } from "./site-server.ts"

let site: ServedSite

test.beforeAll(async () => {
  site = await serveSite()
})

test.afterAll(async () => {
  await site.close()
})

test.use({ viewport: { width: 1470, height: 923 } })

const demo = "[data-editor-demo]"

function playStates(page: Page): Promise<string[]> {
  return page.evaluate(
    (selector) => [
      ...new Set(
        document
          .querySelector(selector)
          ?.getAnimations({ subtree: true })
          .map((animation) => animation.playState),
      ),
    ],
    demo,
  )
}

function demoTime(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const animation = document.querySelector("[data-demo-cursor]")?.getAnimations()[0]
    await animation?.ready
    return Number(animation?.currentTime)
  })
}

function observed(page: Page): Promise<void> {
  return page.evaluate(
    (selector) =>
      new Promise<void>((resolve) => {
        const demoElement = document.querySelector(selector)
        if (!demoElement) throw new Error("no demo")
        new IntersectionObserver(
          (_, observer) => {
            observer.disconnect()
            resolve()
          },
          { threshold: 0.35 },
        ).observe(demoElement)
      }),
    demo,
  )
}

function painted(page: Page): Promise<void> {
  return page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

async function leaveView(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await observed(page)
}

async function enterView(page: Page) {
  await page.locator(demo).scrollIntoViewIfNeeded()
  await observed(page)
}

async function openDemo(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto(`${site.origin}/`)
  await page.locator(demo).scrollIntoViewIfNeeded()
  await expect.poll(() => playStates(page)).toEqual(["running"])
}

test("a visitor pauses the product demo where it is and plays it on from there", async ({ page }) => {
  await openDemo(page)
  const pause = page.getByRole("button", { name: "Pause demo" })
  await expect(pause).toHaveAttribute("aria-pressed", "false")
  const box = await pause.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(44)
  expect(box?.height).toBeGreaterThanOrEqual(44)

  await pause.click()
  await expect(pause).toHaveAttribute("aria-pressed", "true")
  expect(await playStates(page)).toEqual(["paused"])
  const pausedAt = await demoTime(page)
  await painted(page)
  expect(await demoTime(page)).toBe(pausedAt)

  await pause.focus()
  await page.keyboard.press("Space")
  await expect(pause).toHaveAttribute("aria-pressed", "false")
  expect(await playStates(page)).toEqual(["running"])
  await expect.poll(() => demoTime(page)).toBeGreaterThan(pausedAt)
})

test("a paused demo stays paused when it leaves the view and comes back", async ({ page }) => {
  await openDemo(page)
  const pause = page.getByRole("button", { name: "Pause demo" })
  await pause.click()
  await leaveView(page)
  await enterView(page)
  expect(await playStates(page)).toEqual(["paused"])
  await expect(pause).toHaveAttribute("aria-pressed", "true")
})

test("playing the demo while it is out of view waits until it is back in view", async ({ page }) => {
  await openDemo(page)
  const pause = page.getByRole("button", { name: "Pause demo" })
  await pause.click()
  await leaveView(page)
  await pause.evaluate((button: HTMLButtonElement) => button.click())
  await expect(pause).toHaveAttribute("aria-pressed", "false")
  expect(await playStates(page)).toEqual(["paused"])
  await enterView(page)
  expect(await playStates(page)).toEqual(["running"])
})

test("with reduced motion the demo holds still and offers no pause button", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(`${site.origin}/`)
  await page.evaluate(() => document.fonts.ready)
  await enterView(page)
  await painted(page)
  expect(await playStates(page)).toEqual([])
  await expect(page.locator("[data-demo-pause]")).toBeHidden()
})
