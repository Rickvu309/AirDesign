import { expect } from "@playwright/test"

async function drive({ page, siteOrigin }) {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.setViewportSize({ width: 1470, height: 923 })
  await page.goto(`${siteOrigin}/`)
  await page.locator("[data-editor-demo]").scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .querySelector("[data-editor-demo]")
          ?.getAnimations({ subtree: true })
          .some((animation) => animation.playState === "running"),
      ),
    )
    .toBe(true)
}

export default { name: "landing-product-playing", design: null, drive }
