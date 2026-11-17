import { openRowDeck } from "../grid-row-add.mjs"
import { handle } from "../grid-row-move.mjs"

export default {
  name: "grid-row-sections",
  design: "/screens/s41-01-editor-grid-default",
  async drive(kit) {
    await openRowDeck(kit, 6, true)
    if (await handle(kit.page).count()) {
      const first = await kit.page.locator('[data-slide-entry="1"]').boundingBox()
      const second = await kit.page.locator('[data-slide-entry="2"]').boundingBox()
      if (first === null || second === null) throw new Error("row slides")
      await kit.page.mouse.move((first.x + first.width + second.x) / 2, first.y + first.height / 2)
      await kit.expect(handle(kit.page)).toHaveCSS("opacity", "1")
    }
  },
}
