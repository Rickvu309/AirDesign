import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"
import { guideCopy, transitionCopy } from "../../bin/product-copy.mjs"

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/census-updating-spm.pptx"))
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.keyboard.press("Shift+D")
  const add = page.getByRole("button", { name: guideCopy.add })
  if ((await add.count()) === 0) return
  await add.click()
  await page
    .getByRole("button", { name: /settings$/ })
    .first()
    .click()
  await page.locator("[data-layout-guide-settings]").getByText(guideCopy.patterns.columns, { exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-slide-paint] [data-layout-guide=columns] rect")).toHaveCount(5)
}

export default { name: "canvas-layout-guides", design: editor, drive }
