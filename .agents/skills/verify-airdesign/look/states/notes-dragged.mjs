import { notesState } from "../notes-deck.mjs"
import { editor } from "../editor-screen.mjs"

export default {
  name: "notes-dragged",
  design: editor,
  async drive(kit) {
    await notesState(kit, true)
    const handle = kit.page.getByRole("button", { name: "Collapse presenter notes" })
    const box = await handle.boundingBox()
    if (!box) throw new Error("No speaker notes handle")
    await kit.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await kit.page.mouse.down()
    await kit.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 600, { steps: 10 })
    await kit.page.mouse.up()
  },
}
