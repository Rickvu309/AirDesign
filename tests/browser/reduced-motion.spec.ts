import { expect, test, type Locator } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { openDeck, setPanelMode } from "./design-panel"
import { first, store } from "./home-store.ts"
import { fillPanel, shapeAt } from "./shape-fills"

test.use({ viewport: { width: 1600, height: 1000 } })

async function still(element: Locator) {
  await expect(element).toBeVisible()
  expect(
    await element.evaluate((node) => {
      const style = getComputedStyle(node)
      return {
        running: node.getAnimations().length,
        page: document.getAnimations().length,
        animation: style.animationDuration,
        transition: style.transitionDuration,
      }
    }),
  ).toEqual({ running: 0, page: 0, animation: "0s", transition: "0s" })
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
})

test("under reduced motion the editor's color picker opens and closes in its finished state", async ({ page }) => {
  await openDeck(page, "shapes-added.pptx")
  const panel = await fillPanel(page, shapeAt(page, "4"))
  await panel.getByRole("group", { name: "Color", exact: true }).getByRole("button").first().click()
  const picker = page.locator("[data-color-picker]")
  await still(picker)
  await page.keyboard.press("Escape")
  await expect(picker).toHaveCount(0)
})

test("under reduced motion a design section chevron changes state without a transition", async ({ page }) => {
  await openDeck(page, "shapes-added.pptx")
  const panel = await fillPanel(page, shapeAt(page, "4"))
  await setPanelMode(page, "design")
  const section = panel.locator(`[data-design-section="${designCopy.fillDetails}"]`)
  const trigger = section.getByRole("button", { name: designCopy.fillDetails, exact: true })
  const chevron = trigger.locator("svg")
  await still(chevron)
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await trigger.click()
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await still(chevron)
})

test("under reduced motion a deck home menu, dialog and toast open and close in their finished state", async ({
  page,
}) => {
  await store(page, [first])
  await page.goto("/")
  await page.getByRole("button", { name: "home@example.com" }).click()
  const account = page.getByRole("menu")
  await still(account)
  await account.getByRole("menuitem", { name: "Delete account" }).click()
  const dialog = page.getByRole("dialog", { name: "Delete your account?" })
  await still(dialog)
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toHaveCount(0)

  await page.getByRole("button", { name: `${first.name} actions` }).click()
  const actions = page.getByRole("menu")
  await still(actions)
  await actions.getByRole("menuitem", { name: "Move to Trash" }).click()
  await expect(actions).toHaveCount(0)
  const toast = page.locator("[data-sonner-toast]")
  await still(toast)
  await toast.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(toast).toHaveCount(0)
  await expect(page.getByRole("heading", { name: first.name })).toBeVisible()
})
