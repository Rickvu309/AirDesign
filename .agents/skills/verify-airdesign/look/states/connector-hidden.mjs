import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { accent, node, openDoomDeck, spot } from "../doom-deck.mjs"

const fill = (name) => [{ kind: "solid", color: { var: name } }]

async function drive(kit) {
  const { page } = kit
  const opened = await openDoomDeck(kit, [
    {
      id: "w:1",
      type: "frame",
      props: { name: "Frame", box: spot(200, 150, 900, 600), fills: fill("background2"), radius: 16 },
    },
    {
      id: "w:2",
      props: { name: "Target", box: spot(700, 500, 200, 100), geometry: { kind: "rect" }, fills: accent },
    },
    {
      id: "w:3",
      parent: "w:1",
      props: {
        name: "Connector",
        box: spot(80, 80, 620, 320),
        strokes: accent,
        stroke: { weight: 8, align: "center", dash: "solid" },
        geometry: {
          kind: "line",
          start: { node: "w:2", site: "r" },
          end: { x: 80, y: 80 },
          route: "straight",
          arrows: ["arrow", "none"],
        },
      },
    },
  ])
  const hidden = await kit.post(
    kit.doomRoutes.edit,
    {
      deck: opened.deck,
      edit: {
        once: `hide-${String(Date.now())}`,
        author: { kind: "person", id: "other-tab" },
        writes: [{ node: "w:2", prop: "hidden", value: true }],
      },
    },
    opened.cookie,
  )
  if (hidden.json.ok !== true) throw new Error(`hiding the shape was refused: ${JSON.stringify(hidden.json)}`)
  await expect(node(page, "w:2")).toHaveCount(0)
  await expect(node(page, "w:3")).toBeAttached()
}

export default { name: "connector-hidden", design: editor, drive }
