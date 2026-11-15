import { expect, type Page } from "@playwright/test"
import { forward, openClean, signInBrowser, test } from "./api-stack"

test.use({ viewport: { width: 1600, height: 1000 } })

const saved = "Saved"
const saving = "Saving…"
const offline = "Offline, saved on this device"
const unreached = "Unable to reach AirDesign"

function saveStatus(page: Page) {
  return page.locator("[data-save-status]")
}

async function typeAtEnd(page: Page, text: string): Promise<void> {
  const editor = page.locator('[contenteditable="true"]')
  await editor.click()
  await page.keyboard.press("End")
  await editor.pressSequentially(text, { delay: 50 })
}

test("an edit reads Saving while its commit waits and Saved once it lands on the server", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  await expect(saveStatus(page)).toHaveText(saved)
  const revision = async () => (await stack.post("/decks/open", { deck }, cookie)).json.revision as number
  const before = await revision()
  let held = 0
  await page.route(
    (url) => url.pathname === "/decks/commit",
    async (route) => {
      held += 1
      await new Promise((resolve) => setTimeout(resolve, 2500))
      await route.fallback()
    },
  )
  await typeAtEnd(page, "!")
  await expect(saveStatus(page)).toHaveText(saving)
  expect(await revision()).toBe(before)
  await expect(saveStatus(page)).toHaveText(saved, { timeout: 15_000 })
  expect(held).toBeGreaterThan(0)
  expect(await revision()).toBeGreaterThan(before)
})

test("a server that cannot be reached reads the unreached words, then Saved once it answers with no new edit", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await openClean(page)
  const blocked = (url: URL) => url.pathname.startsWith("/decks/")
  await page.route(blocked, (route) => route.abort("connectionfailed"))
  await typeAtEnd(page, "!")
  await expect(saveStatus(page)).toHaveText(unreached)
  await page.unroute(blocked)
  await expect(saveStatus(page)).toHaveText(saved, { timeout: 15_000 })
})

test("going offline reads Offline before any edit, and Saved again when the browser is back", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await openClean(page)
  await expect(saveStatus(page)).toHaveText(saved)
  await context.setOffline(true)
  await expect(saveStatus(page)).toHaveText(offline)
  await context.setOffline(false)
  await expect(saveStatus(page)).toHaveText(saved)
})
