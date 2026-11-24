import { expect } from "@playwright/test"
import { openDesign, openDoomDeck, selectNode, spot } from "../doom-deck.mjs"

const wide = {
  kind: "column",
  categories: ["Current days outstanding", "Q4 target", "Q1 stretch"],
  series: ["Days sales outstanding", "Two", "Three", "Four", "Five"].map((name, at) => ({
    name,
    values: [52 + at, 44, 31.5],
  })),
  labels: true,
}

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [
    {
      id: "c:1",
      type: "frame",
      props: {
        box: spot(160, 560, 1500, 420),
        fills: [{ kind: "solid", color: { var: "background2" } }],
        chart: wide,
      },
    },
  ])
  await openDesign(page)
  await selectNode(page, "c:1", { position: { x: 16, y: 16 } })
  await expect(page.locator("[data-panel-section='chart']")).toBeVisible()
  await page.locator("[data-design-panel]").evaluate((panel) => {
    panel.scrollTop = 0
  })
}

export default { name: "panel-chart-wide", design: null, drive }
