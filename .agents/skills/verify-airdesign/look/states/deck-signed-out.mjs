import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.page.route(
    (url) => url.pathname === "/sign-in",
    (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<main style='font:16px sans-serif;padding:32px'>Sign in</main>",
      }),
  )
  await kit.page.goto("/deck/lost-deck")
  await expect(
    kit.page.getByText("Unable to open this deck").or(kit.page.getByText("Sign in", { exact: true })),
  ).toBeVisible()
}

export default { name: "deck-signed-out", design: null, drive }
