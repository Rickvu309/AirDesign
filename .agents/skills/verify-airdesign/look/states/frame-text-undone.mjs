import { expect } from "@playwright/test"
import { node, openDoomDeck, spot, words } from "../doom-deck.mjs"
import { leaveText, textEditor } from "../doom-text.mjs"

const card = (id) => ({
  id,
  parent: "t:0",
  props: {
    name: `Card ${id}`,
    box: spot(0, 0, 720, 72),
    sizing: { w: "fixed", h: "hug" },
    fills: [{ kind: "solid", color: { var: "background2" } }],
    text: words("A card line", { resize: "height" }),
  },
})

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [
    {
      id: "t:0",
      type: "frame",
      props: {
        name: "Cards",
        box: spot(1000, 160, 720, 400),
        sizing: { w: "fixed", h: "hug" },
        layout: { mode: "column", gap: 24, padding: { t: 0, r: 0, b: 0, l: 0 }, align: "top-left" },
      },
    },
    card("t:1"),
    card("t:2"),
  ])
  const before = await node(page, "t:2").boundingBox()
  const first = await node(page, "t:1").boundingBox()
  await page.mouse.dblclick(first.x + first.width / 2, first.y + first.height / 2)
  await expect(page.locator('[data-selection-outline="t:1"]').or(textEditor(page))).toBeAttached()
  if ((await textEditor(page).count()) === 0) await page.keyboard.press("Enter")
  await expect(textEditor(page)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+End")
  for (const _ of [1, 2, 3]) {
    await page.keyboard.press("Enter")
    await page.keyboard.type("Another line")
  }
  await expect.poll(async () => (await node(page, "t:2").boundingBox()).y - before.y).toBeGreaterThan(20)
  await leaveText(page)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(node(page, "t:1")).not.toContainText("Another line")
  await page.mouse.move(4, 4)
}

export default { name: "frame-text-undone", design: null, drive }
