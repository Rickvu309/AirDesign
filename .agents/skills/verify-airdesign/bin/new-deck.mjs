export async function newBlankDeck(page) {
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByRole("menu", { name: "New deck" }).getByRole("menuitem", { name: "Blank deck", exact: true }).click()
}
