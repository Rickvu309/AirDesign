import { editor } from "../editor-screen.mjs"
import { leaveText, titleEdited } from "../doom-text.mjs"

async function drive(kit) {
  await titleEdited(kit)
  await kit.page.keyboard.press("ControlOrMeta+a")
  await leaveText(kit.page)
}

export default { name: "text-left-unhighlighted", design: editor, drive }
