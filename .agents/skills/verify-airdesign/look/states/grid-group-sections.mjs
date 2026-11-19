import { openGroupDeck } from "../grid-group-add.mjs"
import { handle } from "../grid-group-move.mjs"

export default {
  name: "grid-group-sections",
  design: "/screens/s41-01-editor-grid-default",
  async drive(kit) {
    await openGroupDeck(kit, 6, true)
    if (await handle(kit.page).count()) {
      await handle(kit.page).hover()
      await kit.expect(handle(kit.page)).toHaveCSS("opacity", "1")
    }
  },
}
