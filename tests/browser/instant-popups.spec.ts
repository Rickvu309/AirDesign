import { expect, test, type Locator, type Page } from "@playwright/test"
import { openDeck, picker, shownColor } from "./design-panel"
import { fillPanel, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

async function watchMotion(page: Page) {
  await page.evaluate(() => {
    const failures = new Set<string>()
    const sample = () => {
      for (const popup of document.querySelectorAll('[data-slot="popover-content"]')) {
        const style = getComputedStyle(popup)
        for (const duration of [style.transitionDuration, style.animationDuration]) {
          if (duration.split(",").some((value) => Number.parseFloat(value) !== 0)) failures.add(duration)
        }
      }
      document.documentElement.dataset.popupMotion = JSON.stringify([...failures])
    }
    new MutationObserver(sample).observe(document.body, { subtree: true, childList: true, attributes: true })
    sample()
  })
}

async function instant(page: Page, trigger: Locator, popup: Locator) {
  await trigger.click()
  await expect(popup).toBeVisible()
  await expect(popup).toHaveCSS("opacity", "1")
  await expect(page.locator("html")).toHaveAttribute("data-popup-motion", "[]")
  await page.mouse.click(2, 2)
  await expect(popup).toHaveCount(0)
  await expect(page.locator("html")).toHaveAttribute("data-popup-motion", "[]")
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`the color picker opens and closes instantly under ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await openDeck(page, "shapes-added.pptx")
    const panel = await fillPanel(page, shapeAt(page, "4"))
    await watchMotion(page)
    await instant(page, shownColor(panel.getByRole("group", { name: "Color", exact: true })), picker(page))
  })

  test(`the Icon popup opens and closes instantly under ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await openDeck(page, "clean.pptx")
    await watchMotion(page)
    await instant(page, page.getByRole("button", { name: "Add icon", exact: true }), page.locator("[data-icon-tool]"))
  })

  test(`the toolbar More popup opens and closes instantly under ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.setViewportSize({ width: 800, height: 900 })
    await openDeck(page, "clean.pptx")
    await page.locator('[data-slide-paint] [contenteditable="true"]').click()
    await watchMotion(page)
    await instant(page, page.getByRole("button", { name: "More", exact: true }), page.locator("[data-toolbar-more]"))
  })
}
