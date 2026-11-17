import { editor } from "../editor-screen.mjs"
import { fileURLToPath } from "node:url"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(
    kit.page,
    fileURLToPath(new URL("../../../../../scripts/pptx-fixtures/font-catalog.pptx", import.meta.url)),
  )
  await kit.page.locator("[data-slide-paint] [data-fonts-pending]").first().waitFor({ state: "detached" })
  await kit.page.locator("[data-slide-paint]").getByText("Montserrat titles", { exact: true }).waitFor()
}

export default { name: "font-catalog", design: editor, drive }
