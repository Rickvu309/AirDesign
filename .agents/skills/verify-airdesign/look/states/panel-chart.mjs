import { expect } from "@playwright/test"
import { openDesign, openDoomDeck, selectNode, spot } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [
    {
      id: "c:1",
      type: "frame",
      props: {
        name: "Chart",
        box: spot(160, 180, 1500, 720),
        fills: [{ kind: "solid", color: { var: "background2" } }],
        chart: {
          kind: "bar",
          categories: ["Current DSO", "Q4 target"],
          series: [{ name: "Days sales outstanding", values: [52, 40] }],
          labels: true,
        },
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

export default { name: "panel-chart", design: null, drive }
