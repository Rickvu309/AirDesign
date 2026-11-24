import { expect } from "@playwright/test"
import { editorCopy } from "../../bin/product-copy.mjs"
import { landNodes, openDesign, openDoomDeck, selectNode, spot, words } from "../doom-deck.mjs"
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
    {
      id: "c:1",
      type: "frame",
      props: {
        name: editorCopy.chart,
        box: spot(350, 410, 1250, 505),
        chart: {
          kind: "column",
          categories: ["Q1", "Q2", "Q3", "Q4"],
          series: [{ name: "Revenue", values: [24, 37, 31, 48] }],
          labels: true,
        },
      },
    },
  ])
  await openDesign(page)
  await selectNode(page, "c:1", { position: { x: 16, y: 16 } })
  await expect(page.locator('[data-grip="bottom-right"]')).toBeVisible()
  await page.mouse.move(4, 4)
}

export default { name: "panel-chart", design: null, drive }
