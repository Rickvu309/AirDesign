import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/corpus/nasa-roman-thermal-runtime.pptx"), 10)
  await expect(kit.page.locator("[data-slide-paint] [data-canvas-table]")).toHaveCount(1)
}

export default { name: "table-cells", design: null, drive }
