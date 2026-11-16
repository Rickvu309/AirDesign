import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "./open-deck.mjs"

export async function largeTextBox(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/corpus/nasa-cots-parts-nesc.pptx"), 13)
  const element = kit.page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide13.xml#3"]')
  await expect(element).toBeVisible()
  return element
}

export async function committed(kit, act) {
  const answered = kit.page.waitForResponse(
    (response) => new URL(response.url()).pathname === kit.deckRoutes.commit.path,
  )
  await act()
  await answered
  await kit.page.waitForTimeout(1500)
}
