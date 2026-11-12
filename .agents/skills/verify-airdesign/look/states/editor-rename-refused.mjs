import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { renaming } from "../renaming.mjs"

async function drive(kit) {
  await renaming(kit)
  const field = kit.page.getByRole("textbox", { name: "Deck name" })
  await field.fill("")
  await field.press("Enter")
  await expect(kit.page.getByRole("alert")).toHaveText("Enter a name for this deck.")
}

export default { name: "editor-rename-refused", design: editor, drive }
