import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { serveSite, signedOut, type ServedSite } from "./site-server.ts"

let site: ServedSite

test.beforeAll(async () => {
  site = await serveSite()
})

test.afterAll(async () => {
  await site.close()
})

test.use({ storageState: signedOut })

const viewports = [
  { width: 1470, height: 923 },
  { width: 390, height: 844 },
]

function readCodeRings(page: Page) {
  return page.evaluate(() => {
    const group = document.querySelector("[data-six-digit-code]")
    const boxes = [...document.querySelectorAll("[data-code-box]")]
    const active = document.querySelector("[data-code-box][data-active]")
    const resting = boxes[1]
    if (!group || boxes.length !== 6 || !active || !resting) throw new Error("missing code entry")
    const groupStyle = getComputedStyle(group)
    const activeStyle = getComputedStyle(active)
    const restingStyle = getComputedStyle(resting)
    const caretStyle = getComputedStyle(active, "::after")
    return {
      outlineStyle: groupStyle.outlineStyle,
      outlineWidth: groupStyle.outlineWidth,
      outlineColor: groupStyle.outlineColor,
      activeShadow: activeStyle.boxShadow,
      restingShadow: restingStyle.boxShadow,
      caretContent: caretStyle.content,
      caretColor: caretStyle.backgroundColor,
    }
  })
}

test("the 6-digit code marks the active box with a dark edge on focus and rings the code in the error colour", async ({
  page,
}) => {
  await page.addInitScript(() => sessionStorage.setItem("airdesign.pending-sign-in-email", "ada@example.com"))
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion })
    for (const size of viewports) {
      await page.setViewportSize(size)
      await page.goto(`${site.origin}/sign-in/check`)
      await page.evaluate(() => document.fonts.ready)
      const input = page.getByLabel("Or enter the 6-digit code")
      await input.focus()

      const focused = await readCodeRings(page)
      expect(focused.outlineWidth, `${reducedMotion} ${size.width}px no ring around the code on focus`).toBe("0px")
      expect(focused.activeShadow, `${reducedMotion} ${size.width}px the active box has a dark edge`).toBe(
        "rgb(34, 34, 34) 0px 0px 0px 1.5px inset",
      )
      expect(focused.restingShadow, `${reducedMotion} ${size.width}px a resting box keeps its edge`).not.toBe(
        focused.activeShadow,
      )
      expect(focused.caretContent, `${reducedMotion} ${size.width}px focused caret`).toBe('""')
      expect(focused.caretColor, `${reducedMotion} ${size.width}px focused caret colour`).toBe("rgb(45, 111, 205)")

      await input.pressSequentially("000000")
      await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible()

      const invalid = await readCodeRings(page)
      expect(invalid.outlineStyle, `${reducedMotion} ${size.width}px invalid outline`).toBe("solid")
      expect(invalid.outlineWidth, `${reducedMotion} ${size.width}px invalid width`).toBe("2px")
      expect(invalid.outlineColor, `${reducedMotion} ${size.width}px invalid colour`).toBe("rgb(185, 47, 47)")
      expect(invalid.activeShadow, `${reducedMotion} ${size.width}px no second ring on error`).toBe(
        invalid.restingShadow,
      )
      expect(invalid.caretContent, `${reducedMotion} ${size.width}px invalid caret`).toBe('""')
      expect(invalid.caretColor, `${reducedMotion} ${size.width}px invalid caret colour`).toBe("rgb(185, 47, 47)")
    }
  }
})

test("the sign-in footer underlines its links so they stand apart from plain text", async ({ page }) => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion })
    for (const size of viewports) {
      await page.setViewportSize(size)
      await page.goto(`${site.origin}/sign-in`)
      await page.evaluate(() => document.fonts.ready)
      const styles = await page.evaluate(() => {
        const read = (selector: string) => {
          const element = document.querySelector(selector)
          if (!element) throw new Error(`missing ${selector}`)
          const style = getComputedStyle(element)
          return {
            textDecorationLine: style.textDecorationLine,
            textUnderlineOffset: style.textUnderlineOffset,
          }
        }
        return {
          terms: read('footer a[href="/terms"]'),
          plain: read("footer span"),
          privacy: read('footer a[href="/privacy"]'),
        }
      })
      expect(styles.terms, `${reducedMotion} ${size.width}px terms`).toEqual({
        textDecorationLine: "underline",
        textUnderlineOffset: "2px",
      })
      expect(styles.privacy, `${reducedMotion} ${size.width}px privacy`).toEqual({
        textDecorationLine: "underline",
        textUnderlineOffset: "2px",
      })
      expect(styles.plain.textDecorationLine, `${reducedMotion} ${size.width}px plain text`).toBe("none")
    }
  }
})

async function gradientContrast(page: Page, selector: string, labelSelector?: string) {
  return page.locator(selector).evaluate((element, inner) => {
    const style = getComputedStyle(element)
    const labelElement = inner === null ? element : (element.querySelector(inner) ?? element)
    const labelStyle = getComputedStyle(labelElement)
    const parse = (color: string): [number, number, number] => {
      const match = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
      if (!match) throw new Error(`unexpected color ${color}`)
      return [Number(match[1]), Number(match[2]), Number(match[3])]
    }
    const linear = (channel: number) => {
      const value = channel / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }
    const luminance = ([r, g, b]: [number, number, number]) =>
      0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
    const ratio = (a: [number, number, number], b: [number, number, number]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
    }
    const stops = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((found) => parse(found[0]))
    if (stops.length < 2) throw new Error(`expected gradient, got ${style.backgroundImage}`)
    const label = parse(labelStyle.color)
    return {
      lowest: Math.min(...stops.map((stop) => ratio(label, stop))),
      filter: style.filter,
      opacity: Number(style.opacity),
      labelOpacity: Number(labelStyle.opacity),
      backgroundImage: style.backgroundImage,
    }
  }, labelSelector ?? null)
}

test("all three landing calls to action use the app signature gradient", async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 923 })
  await page.goto(`${site.origin}/`)
  const callsToAction = page.locator("a.primary-button")
  await expect(callsToAction).toHaveCount(3)
  for (const button of await callsToAction.all()) {
    await expect(button).toHaveCSS("background-image", "linear-gradient(rgb(147, 184, 239) 0%, rgb(77, 148, 251) 100%)")
  }

  const hero = page.locator("section.hero-landing a.primary-button")
  await hero.hover()
  await expect(hero).toHaveCSS("filter", "brightness(1.06)")
  await page.mouse.down()
  try {
    await expect(hero).toHaveCSS("filter", "brightness(0.94)")
  } finally {
    await page.mouse.move(0, 0)
    await page.mouse.up()
  }
})

test("the sign-in button clears 4.5:1 at rest and while sending", async ({ page }) => {
  await page.goto(`${site.origin}/sign-in`)
  await page.evaluate(() => document.fonts.ready)
  const submit = "[data-sign-in-form] button.primary-button"
  const signInRest = await gradientContrast(page, submit, "[data-sign-in-label]")
  expect(signInRest.lowest).toBeGreaterThanOrEqual(4.5)
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`${site.origin}/**`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue()
      return
    }
    await held
    await route.abort()
  })
  await page.fill("#sign-in-email", "ada@example.com")
  await page.locator(submit).click()
  await expect(page.locator("[data-sign-in-form] [data-pending]")).toBeVisible()
  const sending = await gradientContrast(page, submit, "[data-sign-in-label]")
  expect(sending.filter).toBe("none")
  expect(sending.opacity).toBe(1)
  expect(sending.labelOpacity).toBe(1)
  expect(sending.lowest).toBeGreaterThanOrEqual(4.5)
  release()
  await page.unrouteAll({ behavior: "ignoreErrors" })
})

test("the check-email card balances its bottom space without jumping when errors or status appear", async ({
  page,
}) => {
  const { signInRoutes } = await import("../../packages/catalog/src/index.ts")
  await page.addInitScript(() => sessionStorage.setItem("airdesign.pending-sign-in-email", "ada@example.com"))
  await page.route(`**${signInRoutes.email.path}`, (route) => route.fulfill({ status: 202, json: { ok: true } }))
  await page.route(`**${signInRoutes.code.path}`, (route) =>
    route.fulfill({ status: 400, json: { ok: false, refusal: "code" } }),
  )

  for (const size of viewports) {
    await page.setViewportSize(size)
    await page.goto(`${site.origin}/sign-in/check`)
    await page.evaluate(() => document.fonts.ready)

    const measure = () =>
      page.evaluate(() => {
        const button = document.querySelector<HTMLElement>("[data-send-again]")
        const status = document.querySelector<HTMLElement>("[data-send-again-status]")
        const card = button?.closest("div")
        const icon = card?.firstElementChild
        const outlook = document.querySelector<HTMLElement>('a[href*="outlook"]')
        const different = document.querySelector<HTMLElement>('a[href="/sign-in"]')
        if (!button || !status || !card || !icon || !outlook || !different) throw new Error("missing check-email parts")
        const range = document.createRange()
        range.selectNodeContents(button)
        const textBox = range.getBoundingClientRect()
        const cardBox = card.getBoundingClientRect()
        const iconBox = icon.getBoundingClientRect()
        const buttonBox = button.getBoundingClientRect()
        const statusBox = status.getBoundingClientRect()
        return {
          topSpace: iconBox.top - cardBox.top,
          bottomSpace: cardBox.bottom - textBox.bottom,
          sendAgainHeight: buttonBox.height,
          cardHeight: cardBox.height,
          outlookTop: outlook.getBoundingClientRect().top,
          differentTop: different.getBoundingClientRect().top,
          statusBottomClearance: cardBox.bottom - statusBox.bottom,
        }
      })

    const initial = await measure()
    expect(initial.sendAgainHeight, `${size.width}px touch target`).toBeGreaterThanOrEqual(44)
    expect(initial.bottomSpace, `${size.width}px bottom balance`).toBeLessThanOrEqual(initial.topSpace + 12)

    await page.getByLabel("Or enter the 6-digit code").pressSequentially("000000")
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible()
    const afterCode = await measure()
    expect(
      Math.abs(afterCode.cardHeight - initial.cardHeight),
      `${size.width}px code error height`,
    ).toBeLessThanOrEqual(0.5)
    expect(
      Math.abs(afterCode.outlookTop - initial.outlookTop),
      `${size.width}px code error outlook`,
    ).toBeLessThanOrEqual(0.5)
    expect(
      Math.abs(afterCode.differentTop - initial.differentTop),
      `${size.width}px code error footer link`,
    ).toBeLessThanOrEqual(0.5)

    await page.locator("[data-send-again]").click()
    await expect(page.locator("[data-send-again-status]")).toContainText("Email sent again.")
    const afterResend = await measure()
    expect(Math.abs(afterResend.cardHeight - initial.cardHeight), `${size.width}px resend height`).toBeLessThanOrEqual(
      0.5,
    )
    expect(
      Math.abs(afterResend.differentTop - initial.differentTop),
      `${size.width}px resend footer link`,
    ).toBeLessThanOrEqual(0.5)
    expect(afterResend.statusBottomClearance, `${size.width}px resend clearance`).toBeGreaterThanOrEqual(10)
  }
})
