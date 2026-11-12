import { expect } from "@playwright/test"
import { askedOnce } from "../asked-once.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await askedOnce(kit)
  await kit.page.reload()
  await expect(kit.page.getByText("Your title now leads with the Q3 number.", { exact: true })).toBeVisible()
}

export default { name: "chat-restored", design: editor, drive }
