import path from "node:path"
import { expect } from "@playwright/test"

export default async function drive(kit) {
  const { repo, page, signIn, capture, note } = kit
  const { email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  const side = page.locator("[data-editor-panel]")
  await expect(side.getByRole("textbox", { name: "Ask Aira" })).toBeVisible()
  await capture("agent-panel")
  note("imported clean.pptx; the Agent panel shows the Ask Aira composer")
}
