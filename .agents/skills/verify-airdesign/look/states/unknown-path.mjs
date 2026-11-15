import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/no-such-page")
  await expect(
    kit.page.getByRole("heading", { name: "Page not found" }).or(kit.page.getByText("Unknown screen")),
  ).toBeVisible()
}

export default { name: "unknown-path", design: "/screens/s34-02-decks-not-found-address", drive }
