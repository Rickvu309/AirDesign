import { undoCopy } from "../../../../../apps/web/src/copy/undo-copy.ts"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { moveThree } from "./three-moved.mjs"

async function drive(kit) {
  await kit.signIn()
  await moveThree(kit)
  await kit.page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true }).click()
  await expect(kit.page.getByRole("button", { name: undoCopy.redoNamed.move, exact: true })).toBeEnabled()
}

export default { name: "three-undone", design: editor, drive }
