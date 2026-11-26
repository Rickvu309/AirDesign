import { expect } from "@playwright/test"
import { packageBuild } from "../../../../../scripts/package-build.mjs"
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
  const doom = await packageBuild(kit.repo, "@airdesign/doom")
  const { fold: saved } = await readDoom(kit, opened)
  const fold = doom.readFold(saved)
  if (fold === undefined) throw new Error("Chart deck could not be read")
  const chart = doom.nodeId("c:3")
  const writes = doom.placeComponent(fold, doom.columnDefinition, {
    frame: chart,
    parent: { id: opened.slide, at: doom.orderKeyBetween(saved.nodes["c:2"].parent.at, null) },
    box: spot(350, 410, 1250, 505),
    data: { rows: [24, 37, 31, 48].map((value, i) => ({ id: `q${i + 1}`, label: `Q${i + 1}`, value })) },
    measure: doom.measureWith({}),
  })
  if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const landed = await kit.post(
    kit.doomRoutes.edit,
    {
      deck: opened.deck,
      edit: { once: "place-column", author: { kind: "person", id: "chart-sample" }, readBase: fold.rev, writes },
    },
    opened.cookie,
  )
  expect(landed.json, JSON.stringify(landed.json)).toMatchObject({ ok: true })
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
