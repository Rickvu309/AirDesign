import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.route(
    (url) => url.pathname === kit.airaRoutes.usage.path,
    (route) => route.continue({ headers: { ...route.request().headers(), [kit.countryHeader]: "CN" } }),
  )
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(
    kit.page
      .locator("[data-editor-panel]")
      .getByText("Aira isn't available in your country or region yet. You can keep editing this deck yourself.", {
        exact: true,
      }),
  ).toBeVisible()
}

export default { name: "agent-not-offered", design: editor, drive }
