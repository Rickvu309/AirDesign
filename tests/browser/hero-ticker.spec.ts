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

async function openHero(page: Page) {
  await page.goto(site.origin)
  await page.evaluate(() => document.fonts.ready)
}

function tickerState(page: Page) {
  return page.locator(".ticker-track").evaluate((track) => ({
    paused: track.hasAttribute("data-paused"),
    playState: track.getAnimations().map((animation) => animation.playState),
    animationName: getComputedStyle(track).animationName,
  }))
}

test.describe("with motion allowed", () => {
  test.use({ reducedMotion: "no-preference" })

  test("a keyboard or touch visitor pauses and resumes the ticker", async ({ page }) => {
    await openHero(page)
    const pause = page.getByRole("button", { name: "Pause the ticker" })
    await expect(pause).toHaveAttribute("aria-pressed", "false")
    expect(await tickerState(page)).toEqual({ paused: false, playState: ["running"], animationName: "ticker-run" })

    await pause.focus()
    await page.keyboard.press("Space")
    await expect(pause).toHaveAttribute("aria-pressed", "true")
    expect(await tickerState(page)).toEqual({ paused: true, playState: ["paused"], animationName: "ticker-run" })

    await page.keyboard.press("Space")
    await expect(pause).toHaveAttribute("aria-pressed", "false")
    expect(await tickerState(page)).toEqual({ paused: false, playState: ["running"], animationName: "ticker-run" })
  })

  test("the pause button keeps its name, sits at the right end of the strip and is a touch target", async ({ page }) => {
    await openHero(page)
    const pause = page.getByRole("button", { name: "Pause the ticker" })
    const strip = page.locator(".ticker-track").locator("xpath=..")
    const [button, bounds] = await Promise.all([pause.boundingBox(), strip.boundingBox()])
    if (button === null || bounds === null) throw new Error("no box")
    expect(button.x + button.width).toBeCloseTo(bounds.x + bounds.width, 0)
    expect(button.width).toBeGreaterThanOrEqual(44)
    expect(button.height).toBeGreaterThanOrEqual(40)
    expect(button.y).toBeGreaterThanOrEqual(bounds.y - 1)
    expect(button.y + button.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1)
    await pause.click()
    await expect(pause).toHaveAccessibleName("Pause the ticker")
  })

  test("a tap pauses the ticker", async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await openHero(page)
    await page.getByRole("button", { name: "Pause the ticker" }).tap()
    expect(await tickerState(page)).toEqual({ paused: true, playState: ["paused"], animationName: "ticker-run" })
    await context.close()
  })

  test("a link eases its colour and presses with the strong curve", async ({ page }) => {
    await openHero(page)
    const link = page.locator(".nav-tab").first()
    const transition = await link.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        properties: style.transitionProperty.split(", "),
        durations: style.transitionDuration.split(", "),
        timings: style.transitionTimingFunction.split(/, (?![^(]*\))/),
      }
    })
    expect(transition.properties).toEqual(["color", "transform"])
    expect(transition.durations).toEqual(["0.15s", "0.15s"])
    expect(transition.timings).toEqual(["ease", "cubic-bezier(0.22, 1, 0.36, 1)"])
  })
})

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("nothing moves and there is nothing to pause", async ({ page }) => {
    await openHero(page)
    expect(await tickerState(page)).toEqual({ paused: false, playState: [], animationName: "none" })
    await expect(page.getByRole("button", { name: "Pause the ticker" })).toBeHidden()
  })
})
