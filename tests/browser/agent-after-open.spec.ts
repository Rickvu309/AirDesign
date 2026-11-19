import { airaCopy, airaStepWords } from "../../apps/web/src/copy/aira-copy.ts"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { forward, openClean, signInBrowser, test } from "./api-stack"

const blank = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")

async function hold(page: Page, path: string): Promise<() => void> {
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      await held
      await route.fallback()
    },
  )
  return release
}

async function importHeld(page: Page): Promise<string> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(blank)
  await expect(page).toHaveURL(/\/deck\//)
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(2)
  return page.url().split("/").at(-1) ?? ""
}

test("Aira asked at once adds the slide when the index lands, and the step stays working until then", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const release = await hold(page, "/decks/index")
  const deck = await importHeld(page)
  stack.aira({ name: "add-slide.sse", fill: { deck, base: "0" } }, { name: "edited.sse" })
  await page.getByRole("textbox", { name: "Ask Aira" }).fill("Add a slide")
  await page.keyboard.press("Enter")
  await expect(page.getByText(airaStepWords.edit_deck.working)).toBeVisible()
  await page.waitForTimeout(2500)
  await expect(page.getByText(airaStepWords.edit_deck.working)).toBeVisible()
  await expect(page.getByText(airaStepWords.edit_deck.refused)).toHaveCount(0)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  release()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(page.getByText(airaStepWords.edit_deck.done)).toBeVisible()
  await expect(page.getByText(airaStepWords.edit_deck.refused)).toHaveCount(0)
})

test("an outside agent's add_slide is refused with the reason while the index is held, then lands", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const release = await hold(page, "/decks/index")
  const deck = await importHeld(page)
  const call = { deck, base: 0, after: "256", layout: "256" }
  for (let n = 0; n < 35; n += 1) {
    expect(
      await stack.callTool(
        "airdesign_edit_deck",
        (({ deck, base, ...change }) => ({ deck, base, changes: [{ op: "add_slide", ...change }] }))(call),
        cookie,
      ),
    ).toMatchObject({ ok: false, refusal: "indexing" })
  }
  release()
  await expect
    .poll(async () => (await stack.callTool("airdesign_read_deck", { deck }, cookie)).index, { timeout: 15_000 })
    .toBe("ready")
  expect(
    await stack.callTool(
      "airdesign_edit_deck",
      (({ deck, base, ...change }) => ({ deck, base, changes: [{ op: "add_slide", ...change }] }))(call),
      cookie,
    ),
  ).toMatchObject({ ok: true })
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
})

test("Aira asked before the server's first open of a new deck adds the slide once the open lands", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const release = await hold(page, "/decks/open")
  const deck = await importHeld(page)
  stack.aira({ name: "add-slide.sse", fill: { deck, base: "0" } }, { name: "edited.sse" })
  await page.getByRole("textbox", { name: "Ask Aira" }).fill("Add a slide")
  await page.keyboard.press("Enter")
  await expect(page.getByText(airaStepWords.edit_deck.working)).toBeVisible()
  await page.waitForTimeout(1500)
  release()
  await expect(page.getByText(airaStepWords.edit_deck.done)).toBeVisible({ timeout: 10_000 })
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
})

test("Aira's edit paints on the slide while the imported file is still uploading", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const release = await hold(page, "/decks/original/upload")
  const uploading = page.waitForRequest((request) => new URL(request.url()).pathname === "/decks/original/upload")
  const deck = await openClean(page)
  stack.aira({ name: "edit.sse", fill: { deck, base: "0", node: "256.2" } }, { name: "edited.sse" })
  await page.getByRole("textbox", { name: airaCopy.askAira }).fill("Change the title to Hello from Aira")
  await page.keyboard.press("Enter")
  await uploading
  await expect(page.getByText(airaStepWords.edit_deck.done)).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello from Aira")
  release()
})
