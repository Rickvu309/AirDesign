import path from "node:path"
import { expect } from "@playwright/test"

export default async function drive({ repo, page, context, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const address = page.url()
  const deck = address.split("/").at(-1)
  const text = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(text).toHaveText("Hello")
  const server = async () => JSON.stringify((await post(deckRoutes.open, { deck }, cookie)).json.register)
  const journal = () =>
    page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("airdesign:unsaved:")))

  await text.dblclick()
  await page.keyboard.press("ControlOrMeta+a")
  await text.pressSequentially("Kept", { delay: 0 })
  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await expect(text).toHaveText("Kept")
  await capture("reloaded")
  await expect.poll(server, { timeout: 15_000 }).toContain("Kept")
  await expect.poll(journal).toEqual([])
  note("typed Kept and reloaded in the same breath: the slide and the server read Kept, and the journal is empty")

  let release = () => undefined
  const held = new Promise((resolve) => {
    release = resolve
  })
  const opening = (url) => url.pathname === deckRoutes.open.path
  await page.route(opening, async (route) => {
    await held
    await route.continue().catch(() => undefined)
  })
  await page.reload()
  await expect(text).toHaveText("Kept")
  await expect(page.locator(".thin-page")).not.toHaveAttribute("data-deck-ready", /.+/)
  await capture("device-paint")
  release()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await page.unroute(opening)
  note("with the server's open held, the device copy painted Kept, and the deck was ready once the open landed")

  await text.dblclick()
  await page.keyboard.press("ControlOrMeta+a")
  await text.pressSequentially("Closed", { delay: 0 })
  await page.close()
  const next = await context.newPage()
  await next.goto(address)
  await expect(next.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await expect(next.locator('[data-slide-paint] [contenteditable="true"]')).toHaveText("Closed")
  await expect.poll(server, { timeout: 15_000 }).toContain("Closed")
  note("typed Closed and closed the tab at once: a new tab and the server read Closed")

  await next.route(
    (url) => url.pathname === deckRoutes.open.path,
    (route) => route.fulfill({ json: { ok: false, refusal: "deleted" } }),
  )
  await next.reload()
  await expect(next.locator("[data-deck-refused]")).toContainText("Deck not found")
  await expect(next.getByRole("link", { name: "Go to your decks" })).toBeVisible()
  await expect(next.locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(next.getByRole("button", { name: "Export" })).toHaveCount(0)
  note("an open refused as deleted closed the editor: Deck not found, Go to your decks, no text and no Export")
}
