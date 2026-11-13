import { join } from "node:path"
import { expect, type BrowserContext, type Page } from "@playwright/test"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
import { forward, settled, signInBrowser, test, type Stack } from "./api-stack"

async function open(page: Page, context: BrowserContext, stack: Stack, fixture: string) {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(process.cwd(), "scripts/pptx-fixtures", fixture))
  await expect(page).toHaveURL(/\/deck\//)
  await settled(page)
  const deck = page.url().split("/").at(-1) ?? ""
  return { cookie, deck, side: page.locator("[data-editor-panel]") }
}

test("a blank deck offers drafting starters, and one click adds and titles a slide", async ({
  page,
  context,
  stack,
}) => {
  const { cookie, deck, side } = await open(page, context, stack, "blank.pptx")
  for (const starter of airaCopy.draftStarters) await expect(side.getByRole("button", { name: starter })).toBeVisible()
  for (const starter of airaCopy.repairStarters)
    await expect(side.getByRole("button", { name: starter })).toHaveCount(0)
  const base = Number((await stack.post("/decks/open", { deck }, cookie)).json.revision)
  stack.aira(
    { name: "add-slide.sse", fill: { deck, base: String(base) } },
    { name: "title-slide.sse", fill: { deck, base: String(base + 1), node: "257.2" } },
    { name: "edited.sse" },
  )
  await side.getByRole("button", { name: "Add an agenda slide after the title" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(page.locator('[data-slide-entry="2"]')).toContainText("Hello from Aira")
})

test("a deck with words on two slides offers repair starters", async ({ page, context, stack }) => {
  const { side } = await open(page, context, stack, "sections-before.pptx")
  for (const starter of airaCopy.repairStarters) await expect(side.getByRole("button", { name: starter })).toBeVisible()
  for (const starter of airaCopy.draftStarters) await expect(side.getByRole("button", { name: starter })).toHaveCount(0)
})
