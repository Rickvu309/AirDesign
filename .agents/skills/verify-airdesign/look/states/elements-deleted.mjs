import { undoCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { importTitleDeck } from "../../bin/new-deck.mjs"
import { editor } from "../editor-screen.mjs"

const slide = "ppt/slides/slide1.xml"

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await importTitleDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const element = (shape) => page.locator(`[data-slide-paint] [data-canvas-element="${slide}#${shape}"]`)
  for (const name of ["Rectangle", "Ellipse"]) {
    await page.getByRole("button", { name: "Shapes", exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    await page.keyboard.press("Enter")
  }
  await expect(element(5)).toBeVisible()
  await element(4).click()
  await element(5).click({ modifiers: ["Shift"] })
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(2)
  await page.keyboard.press("Delete")
  await expect(element(5)).toHaveCount(0)
  await expect(page.getByRole("button", { name: undoCopy.undoNamed["delete-element"], exact: true })).toBeEnabled()
}

export default { name: "elements-deleted", design: editor, drive }
