import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"
import { editor } from "../editor-screen.mjs"

const require = createRequire(import.meta.url)
const { tableCopy } = require("../../../../../apps/web/src/copy/table-copy.ts")
const { transitionCopy } = require("../../../../../apps/web/src/copy/transition-copy.ts")

async function drive(kit) {
  await fixtureDeck(kit, "table-added.pptx")
  await kit.page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await kit.page.locator("[data-slide-paint] [data-canvas-table]").click()
  await kit.page.getByRole("button", { name: tableCopy.row(1), exact: true }).click()
  const cells = kit.page.locator("[data-table-cells]")
  await cells.getByRole("button", { name: tableCopy.bold, exact: true }).click()
  await expect(cells.getByRole("button", { name: tableCopy.bold, exact: true })).toHaveAttribute("aria-pressed", "true")
}

export default { name: "table-cells-panel", design: "/screens/s43-09-editor-tools-design-element", drive }
