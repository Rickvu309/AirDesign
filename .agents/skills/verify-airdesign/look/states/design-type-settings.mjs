import { createRequire } from "node:module"
import { join } from "node:path"
import { fixtureDeck } from "../fixture-deck.mjs"
import { setPanelMode } from "../panel-mode.mjs"

async function drive(kit) {
  const { page, repo } = kit
  const require = createRequire(import.meta.url)
  const { textCopy } = require(join(repo, "apps/web/src/copy/text-copy.ts"))
  const { transitionCopy } = require(join(repo, "apps/web/src/copy/transition-copy.ts"))
  await fixtureDeck(kit, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await setPanelMode(page, "design")
  await page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
    .click({ position: { x: 4, y: 4 } })
  await page.getByRole("button", { name: textCopy.settings, exact: true }).click()
}

export default { name: "design-type-settings", design: "/screens/s43-09-editor-tools-design-element", drive }
