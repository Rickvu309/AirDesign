export async function newDoomDeck(page) {
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.locator("[data-doom-ready]").waitFor()
}
