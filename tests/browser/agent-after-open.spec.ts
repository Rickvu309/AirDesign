import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { forward, signInBrowser, test } from "./api-stack"

const blank = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")

async function holdIndex(page: Page): Promise<() => void> {
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    (url) => url.pathname === "/decks/index",
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
  const release = await holdIndex(page)
  const deck = await importHeld(page)
  stack.aira({ name: "add-slide.sse", fill: { deck, base: "0" } }, { name: "edited.sse" })
  await page.getByRole("textbox", { name: "Ask Aira" }).fill("Add a slide")
  await page.keyboard.press("Enter")
  await expect(page.getByText("Adding a slide")).toBeVisible()
  await page.waitForTimeout(2500)
  await expect(page.getByText("Adding a slide")).toBeVisible()
  await expect(page.getByText("Couldn't add a slide")).toHaveCount(0)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  release()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(page.getByText("Added a slide")).toBeVisible()
  await expect(page.getByText("Couldn't add a slide")).toHaveCount(0)
})

test("an outside agent's add_slide is refused with the reason while the index is held, then lands", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const release = await holdIndex(page)
  const deck = await importHeld(page)
  const call = { deck, base: 0, after: "256", layout: "256" }
  for (let n = 0; n < 35; n += 1) {
    expect(await stack.callTool("airdesign_add_slide", call, cookie)).toMatchObject({ ok: false, refusal: "indexing" })
  }
  release()
  await expect
    .poll(async () => (await stack.callTool("airdesign_read_deck", { deck }, cookie)).index, { timeout: 15_000 })
    .toBe("ready")
  expect(await stack.callTool("airdesign_add_slide", call, cookie)).toMatchObject({ ok: true })
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
})
