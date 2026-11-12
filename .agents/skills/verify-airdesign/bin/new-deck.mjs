export async function newBlankDeck(page) {
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByRole("group", { name: "New deck" }).getByRole("button", { name: "Blank deck", exact: true }).click()
}
