import { expect } from "@playwright/test"
import { selectMany, selectedIds } from "../doom-canvas.mjs"
import { accent, openDoomDeck, spot, words as text } from "../doom-deck.mjs"

const words = "Market context and sizing"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [
    {
      id: "w:1",
      props: {
        name: "Gold star",
        box: spot(960, 220, 160, 160),
        geometry: { kind: "icon", name: "lucide/star" },
        strokes: accent,
        stroke: { weight: 12, align: "center", dash: "solid" },
      },
    },
    { id: "w:2", props: { name: words, box: spot(1160, 250, 600, 100), text: text(words) } },
  ])
  await selectMany(page, ["w:1", "w:2"])
  await page.keyboard.press("ControlOrMeta+KeyG")
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
  const [group] = await selectedIds(page)
  await page.keyboard.press("ControlOrMeta+KeyD")
  await expect(page.locator(`[data-selection-outline="${group}"]`)).toHaveCount(0)
  for (let step = 0; step < 20; step += 1) await page.keyboard.press("Shift+ArrowDown")
  await expect(page.locator("[data-slide-box]").getByText(words, { exact: true })).toHaveCount(2)
}

export default { name: "group-text-copy", design: "/screens/s43-10-editor-tools-layers", drive }
