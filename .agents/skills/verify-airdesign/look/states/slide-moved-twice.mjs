import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const entries = kit.page.locator("[data-slide-entry]")
  for (const count of [2, 3]) {
    await kit.page.getByRole("button", { name: "Add slide" }).click()
    await expect(entries).toHaveCount(count)
  }
  await entries.first().click()
  const helloAt = async () => (await entries.allTextContents()).findIndex((each) => each.includes("Hello")) + 1
  await kit.page.keyboard.press("Alt+ArrowDown")
  await expect.poll(helloAt).toBe(2)
  await kit.page.keyboard.press("Alt+ArrowDown")
  await expect.poll(helloAt).not.toBe(2)
}

export default { name: "slide-moved-twice", design: editor, drive }
