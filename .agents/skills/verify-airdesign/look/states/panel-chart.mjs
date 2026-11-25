import { expect } from "@playwright/test"
import { connectOutsideAgent } from "../../journeys/aira-panel.mjs"
import { landNodes, openDesign, openDoomDeck, readDoom, spot, words } from "../doom-deck.mjs"
import { emptySlide } from "../doom-slides.mjs"

async function drive(kit) {
  const { page } = kit
  const opened = await openDoomDeck(kit)
  await emptySlide(kit, opened)
  await landNodes(kit, opened, [
    {
      id: "c:2",
      props: {
        box: spot(350, 190, 1250, 140),
        text: words("Quarterly revenue", { style: "title" }),
      },
    },
  ])
  const call = await connectOutsideAgent(kit, opened.cookie, "Chart sample")
  const { rev: base } = await readDoom(kit, opened)
  const landed = await call("edit_deck", {
    deck: opened.deck,
    base,
    changes: [
      {
        op: "add",
        kind: "component",
        component: "column",
        slide: opened.slide,
        box: { x: 350, y: 410, w: 1250, h: 505 },
        data: { rows: [24, 37, 31, 48].map((value, i) => ({ id: `q${i + 1}`, label: `Q${i + 1}`, value })) },
      },
    ],
  })
  expect(landed.ok).toBe(true)
  expect((await call("stop_run", { deck: opened.deck, runId: landed.runId })).ok).toBe(true)
  await expect(page.getByText("Chart sample is editing this slide")).toHaveCount(0)
  const chart = landed.added.find(({ kind }) => kind === "component").id
  await expect(page.locator(`[data-slide-box] [data-node="${chart}"]`)).toBeAttached()
  await openDesign(page)
  const bar = (await readDoom(kit, opened)).fold.nodes[chart].instance.parts.find(({ key }) => key[0] === "bar").node
  const mark = page.locator(`[data-slide-box] [data-node="${bar}"]`)
  const bounds = await mark.boundingBox()
  if (bounds === null) throw new Error("chart bar did not paint")
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await expect(page.locator(`[data-selection-outline="${chart}"]`)).toBeAttached()
  await expect(page.locator('[data-grip="bottom-right"]')).toBeVisible()
  await page.mouse.move(4, 4)
}

export default { name: "panel-chart", design: null, drive }
