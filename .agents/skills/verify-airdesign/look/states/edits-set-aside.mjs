import { expect } from "@playwright/test"
import { importedDeck, pendingSlide, shownOrFailed } from "../lost-answer.mjs"

const told = "Unable to save some edits. The deck changed, so make them again if you need them."

async function drive(kit) {
  const { page, context } = kit
  const { cookie, deck } = await importedDeck(kit)
  await context.setOffline(true)
  await page.getByRole("button", { name: "Add slide" }).first().click()
  await expect.poll(() => pendingSlide(page)).not.toBe(null)
  const mine = await pendingSlide(page)
  await kit.post(kit.deckRoutes.commit, { deck, batch: [{ ...mine.slideEdit, file: mine.slideFile }] }, cookie)
  await context.setOffline(false)
  await shownOrFailed(page, told)
}

export default { name: "edits-set-aside", design: "/screens/s49-03-editor-errors-edits-set-aside", drive }
