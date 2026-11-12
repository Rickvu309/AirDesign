import { join } from "node:path"
import { expect } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { forward, signInBrowser, test } from "./api-stack"

test("Aira adds a slide and titles it live, and reload keeps the slide", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(process.cwd(), "scripts/pptx-fixtures/blank.pptx"))
  await expect(page).toHaveURL(/\/deck\//)
  const deck = page.url().split("/").at(-1) ?? ""
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(2)
  const base = Number((await stack.post("/decks/open", { deck }, cookie)).json.revision)
  stack.aira(
    { name: "add-slide.sse", fill: { deck, base: String(base) } },
    { name: "title-slide.sse", fill: { deck, base: String(base + 1), node: "257.2" } },
    { name: "edited.sse" },
  )
  await page.getByRole("textbox", { name: "Ask Aira" }).fill("Add a slide and title it Hello from Aira")
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  const added = page.locator('[data-slide-entry="2"]')
  await expect(added).toContainText("Hello from Aira")
  await added.click()
  await expect(page.locator('[contenteditable="true"]').first()).toHaveText("Hello from Aira")
  await page.reload()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(page.locator('[data-slide-entry="2"]')).toContainText("Hello from Aira")
  await page.locator("[data-editor-panel]").getByRole("button", { name: productCopy.undo }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
})
