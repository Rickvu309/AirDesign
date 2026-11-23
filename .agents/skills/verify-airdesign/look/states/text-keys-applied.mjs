import { leaveText, titleEdited } from "../doom-text.mjs"

async function drive(kit) {
  const { page } = kit
  await titleEdited(kit)
  await page.keyboard.press("ControlOrMeta+a")
  for (const key of ["ControlOrMeta+Shift+KeyX", "ControlOrMeta+Alt+KeyT"]) await page.keyboard.press(key)
  await leaveText(page)
}

export default { name: "text-keys-applied", design: "/screens/s43-08-editor-tools-text-format", drive }
