import { expect } from "@playwright/test"
import { openDoomDeck, spot } from "../doom-deck.mjs"
import { editText, textEditor, textLayer } from "../doom-text.mjs"

const chars = "Plan the launch\nHire two sellers\nTrain them on the deck\nShip in March"
const paras = [{ list: "bullet" }, { list: "bullet", level: 1 }, { list: "bullet", level: 2 }, { list: "bullet" }]

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [textLayer("t:1", chars, spot(960, 160, 860, 360), { paras })])
  await expect(page.locator('[data-slide-box] [data-node="t:1"] [data-label]')).toHaveCount(4)
  await editText(page, "t:1")
  await page.keyboard.press("ControlOrMeta+End")
  await page.keyboard.press("Tab")
  const labels = textEditor(page).locator("[data-label]")
  const left = async (label) => (await label.boundingBox())?.x ?? 0
  await expect.poll(async () => (await left(labels.last())) > (await left(labels.first()))).toBe(true)
}

export default { name: "text-list-levels", design: "/screens/s43-08-editor-tools-text-format", drive }
