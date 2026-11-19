import path from "node:path"
import { expect } from "@playwright/test"
import { airaCopy, airaStepWords } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  const { cookie } = await kit.signIn()
  await kit.page.goto("/")
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.index.path,
    () => new Promise(() => undefined),
  )
  await kit.page.locator("input[type=file]").setInputFiles(path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(kit.page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = kit.page.url().split("/").at(-1)
  const title = kit.page.locator('[contenteditable="true"]')
  await expect(title).toHaveText("Hello")
  const base = (await kit.post(kit.deckRoutes.open, { deck }, cookie)).json.revision
  kit.aira([{ name: "edit.sse", fill: { deck, base: String(base), node: "256.2" } }, { name: "edited.sse" }])
  const side = kit.page.locator("[data-editor-panel]")
  await side.getByRole("textbox", { name: airaCopy.askAira }).fill("Change the title to Hello from Aira")
  await side.getByRole("textbox", { name: airaCopy.askAira }).press("Enter")
  await expect(side.getByText(airaStepWords.edit_deck.done)).toBeVisible()
}

export default { name: "aira-title-while-indexing", design: editor, drive, aira: true }
