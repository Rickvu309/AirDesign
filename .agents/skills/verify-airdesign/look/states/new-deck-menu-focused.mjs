import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  const button = kit.page.getByRole("button", { name: "New deck", exact: true })
  await expect(button).toBeVisible()
  await button.focus()
  await kit.page.keyboard.press("Enter")
  await kit.page.keyboard.press("ArrowDown")
  await expect(
    kit.page
      .getByRole("button", { name: "Blank deck", exact: true })
      .or(kit.page.getByRole("menuitem", { name: "Blank deck" }))
      .first(),
  ).toBeVisible()
}

export default { name: "new-deck-menu-focused", design: "/screens/s32-01-decks-new-deck-menu-open", drive }
