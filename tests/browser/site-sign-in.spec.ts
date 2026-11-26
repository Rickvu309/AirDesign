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

test("the 6-digit code draws one ring at a time, focus colour on focus and error colour on error", async ({ page }) => {
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
      expect(focused.outlineStyle, `${reducedMotion} ${size.width}px focused outline`).toBe("solid")
      expect(focused.outlineWidth, `${reducedMotion} ${size.width}px focused width`).toBe("2px")
      expect(focused.outlineColor, `${reducedMotion} ${size.width}px focused colour`).toBe("rgb(45, 111, 205)")
      expect(focused.activeShadow, `${reducedMotion} ${size.width}px no second ring on focus`).toBe(
        focused.restingShadow,
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
