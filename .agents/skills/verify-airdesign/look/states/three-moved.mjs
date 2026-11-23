import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { accent, node, openDoomDeck, savedNode, selectNode, spot } from "../doom-deck.mjs"

const shapes = [
  { id: "w:1", props: { name: "Left card", box: spot(240, 740, 360, 200), geometry: { kind: "rect" }, fills: accent } },
  {
    id: "w:2",
    props: {
      name: "Middle dot",
      box: spot(800, 740, 200, 200),
      geometry: { kind: "ellipse" },
      fills: [{ kind: "solid", color: { var: "accent2" } }],
    },
  },
  {
    id: "w:3",
    props: {
      name: "Right card",
      box: spot(1200, 740, 360, 200),
      geometry: { kind: "rect" },
      fills: [{ kind: "solid", color: { var: "accent3" } }],
    },
  },
]

export async function moveThree(kit) {
  const { page } = kit
  const opened = await openDoomDeck(kit, shapes)
  await selectNode(page, "w:1")
  await selectNode(page, "w:2", { shift: true })
  await selectNode(page, "w:3", { shift: true })
  await expect(page.locator("[data-selection-outline]")).toHaveCount(3)
  const grabbed = await node(page, "w:2").boundingBox()
  await page.mouse.move(grabbed.x + grabbed.width / 2, grabbed.y + grabbed.height / 2)
  await page.mouse.down()
  await page.mouse.move(grabbed.x + grabbed.width / 2 + 60, grabbed.y + grabbed.height / 2 + 24, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await savedNode(kit, opened, "w:2")).box.y).toBeGreaterThan(740)
  return opened
}

export default { name: "three-moved", design: editor, drive: moveThree }
