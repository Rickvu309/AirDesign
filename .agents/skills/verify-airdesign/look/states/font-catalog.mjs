import { expect } from "@playwright/test"
import { openDoomDeck, spot } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { textLayer } from "../doom-text.mjs"

const fonts = ["Montserrat", "Playfair Display", "Lora", "IBM Plex Sans"]

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(
    kit,
    fonts.map((font, at) =>
      textLayer(`t:${String(at + 1)}`, `${font} titles`, spot(1000, 200 + at * 160, 800, 120), {
        spans: [{ end: `${font} titles`.length, font, size: 56 }],
      }),
    ),
  )
  await expect(page.locator("[data-slide-box] [data-fonts-pending]")).toHaveCount(0)
  await expect(page.locator("[data-slide-box]").getByText("Montserrat titles", { exact: true })).toBeVisible()
  await page.waitForFunction((families) => families.every((family) => document.fonts.check(`56px "${family}"`)), fonts)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

export default { name: "font-catalog", design: editor, drive }
