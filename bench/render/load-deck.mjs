import assert from "node:assert/strict"
export async function loadDeck(page, deck) {
  await page.getByLabel("Deck JSON", { exact: true }).fill(JSON.stringify(deck))
  await page.getByRole("button", { name: "Load saved deck", exact: true }).click()
  assert.equal(await page.locator("pre[role=status]").textContent(), "Loaded saved deck", "Deck load was rejected")
  await page.locator("[data-ready=true]").waitFor()
  await page.getByRole("button", { name: "Save deck JSON", exact: true }).click()
  assert.deepEqual(JSON.parse(await page.getByLabel("Deck JSON", { exact: true }).inputValue()), deck, "Loaded deck identity and content")
}
