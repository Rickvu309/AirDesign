import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"
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

  test("the pause button keeps its name, sits at the right end of the strip and is a touch target", async ({
    page,
  }) => {
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

const widths = [
  { width: 1470, height: 923 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]

function cutByAClip(page: Page) {
  return page.evaluate(() => {
    const cut = (element: Element) => {
      const found: string[] = []
      for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue
        const quote = (node.textContent ?? "").trim()
        if (quote === "") continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const rect of range.getClientRects()) {
          if (rect.width <= 0 || rect.height <= 0) continue
          for (let at = element.parentElement; at && at !== document.body; at = at.parentElement) {
            const style = getComputedStyle(at)
            const clips = (value: string) => value === "clip" || value.endsWith("idden")
            const clipX = clips(style.overflowX)
            const clipY = clips(style.overflowY)
            if (!clipX && !clipY) continue
            const edge = at.getBoundingClientRect()
            const left = edge.left + at.clientLeft
            const top = edge.top + at.clientTop
            const right = left + at.clientWidth
            const bottom = top + at.clientHeight
            const pastX = clipX && (rect.left < left - 1 || rect.right > right + 1)
            const pastY = clipY && (rect.top < top - 1 || rect.bottom > bottom + 1)
            if (pastX || pastY) found.push(quote)
          }
        }
      }
      return found
    }
    const bar = document.querySelector(".ticker-bar")
    const proofs =
      bar === undefined || bar === null ? [] : [...bar.querySelectorAll("span")].flatMap((span) => cut(span))
    const headerText: string[] = []
    for (const link of document.querySelectorAll("header a")) {
      headerText.push(...cut(link))
      for (const span of link.querySelectorAll("span")) headerText.push(...cut(span))
    }
    const cta = document.querySelector("section a.primary-button")
    const cluster = bar?.parentElement ?? null
    const gap =
      cluster === null || cta === null ? 0 : cluster.getBoundingClientRect().top - cta.getBoundingClientRect().bottom
    return { proofs: [...new Set(proofs)], headerText: [...new Set(headerText)], gap }
  })
}

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("nothing moves and there is nothing to pause", async ({ page }) => {
    await openHero(page)
    expect(await tickerState(page)).toEqual({ paused: false, playState: [], animationName: "none" })
    await expect(page.getByRole("button", { name: "Pause the ticker" })).toBeHidden()
  })

  test("every proof on the strip is fully readable", async ({ page }) => {
    await openHero(page)
    for (const size of widths) {
      await page.setViewportSize(size)
      await page.evaluate(() => document.fonts.ready)
      await page.locator(".ticker-track").scrollIntoViewIfNeeded()
      const read = await cutByAClip(page)
      expect(read.proofs, `${size.width}px`).toEqual([])
      expect(read.gap, `${size.width}px below the hero link`).toBeGreaterThan(8)
    }
  })

  test("the header name stays readable after the hero scrolls away", async ({ page }) => {
    await openHero(page)
    for (const size of [
      { width: 1470, height: 923 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(size)
      for (const target of ["#product", "#agents", "#pricing"]) {
        await page.locator(target).scrollIntoViewIfNeeded()
        expect((await cutByAClip(page)).headerText, `${size.width}px ${target}`).toEqual([])
      }
    }
  })
})
