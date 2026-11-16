import { expect, test, type Page } from "@playwright/test"
import { openDeck, settled } from "./design-panel"

test.use({ viewport: { width: 1600, height: 1000 } })

function panelButton(page: Page, name: "Agent" | "Design") {
  return page.getByRole("group", { name: "Panel", exact: true }).getByRole("button", { name, exact: true })
}

test("a deck opens again on the panel a person last used there, and a new deck opens on Agent", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  await expect(panelButton(page, "Agent")).toHaveAttribute("aria-pressed", "true")
  await panelButton(page, "Design").click()
  await expect(page.locator("[data-design-panel]")).toBeVisible()

  await page.reload()
  await settled(page)
  await expect(panelButton(page, "Design")).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("[data-design-panel]")).toBeVisible()

  await panelButton(page, "Agent").click()
  await page.reload()
  await settled(page)
  await expect(panelButton(page, "Agent")).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("[data-design-panel]")).toHaveCount(0)

  await panelButton(page, "Design").click()
  await openDeck(page, "clean.pptx")
  await expect(panelButton(page, "Agent")).toHaveAttribute("aria-pressed", "true")
})

test("a deck still opens and switches panels when the browser refuses storage", async ({ page }) => {
  await page.addInitScript(() => {
    const refuse = () => {
      throw new DOMException("refused", "SecurityError")
    }
    Storage.prototype.getItem = refuse
    Storage.prototype.setItem = refuse
  })
  await openDeck(page, "clean.pptx")
  await expect(panelButton(page, "Agent")).toHaveAttribute("aria-pressed", "true")
  await panelButton(page, "Design").click()
  await expect(page.locator("[data-design-panel]")).toBeVisible()
  await page.reload()
  await settled(page)
  await expect(panelButton(page, "Agent")).toHaveAttribute("aria-pressed", "true")
})
