import { openRowDeck } from "../grid-row-add.mjs"
import { handle } from "../grid-row-move.mjs"

export default {
  name: "grid-row-sections",
  design: "/screens/s41-01-editor-grid-default",
  async drive(kit) {
    await openRowDeck(kit, 6, true)
    if (await handle(kit.page).count()) {
      await handle(kit.page).hover()
      await kit.expect(handle(kit.page)).toHaveCSS("opacity", "1")
    }
  },
}
