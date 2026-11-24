import { expect } from "@playwright/test"
import { solid } from "../doom-canvas.mjs"
import { node, openDoomDeck, spot } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { editText, textEditor, textLayer } from "../doom-text.mjs"

const nodes = [
  textLayer("w:1", "Quarterly revenue by region", spot(200, 300, 500, 100), { resize: "widthAndHeight" }),
  {
    id: "w:2",
    props: {
      name: "Revenue arrow",
      box: spot(0, 0, 10, 10),
      geometry: {
        kind: "line",
        start: { node: "w:1", site: "r" },
        end: { x: 1400, y: 700 },
        route: "straight",
        arrows: ["none", "arrow"],
      },
      strokes: solid("text"),
      stroke: { weight: 3, align: "center", dash: "solid" },
    },
  },
]

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, nodes)
  await expect(node(page, "w:2")).toBeVisible()
  await editText(page, "w:1")
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Backspace")
  await expect(textEditor(page)).toBeFocused()
}

export default { name: "connector-text-emptied", design: editor, drive }
