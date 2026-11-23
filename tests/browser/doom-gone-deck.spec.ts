import { expect, type Page } from "@playwright/test"
import { forward, signInBrowser, test } from "./api-stack"
import { clickSlide, openDoomEditor } from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const routes = async () => (await import("../../packages/catalog/src/index.ts")).deckRoutes

const keptRows = (page: Page, deck: string) =>
  page.evaluate(
    (id) =>
      new Promise<number>((resolve, reject) => {
        const opening = indexedDB.open("airdesign")
        opening.onerror = () => reject(opening.error)
        opening.onsuccess = () => {
          const store = [...opening.result.objectStoreNames]
          const keys = opening.result
            .transaction(store)
            .objectStore(store[0] ?? "")
            .getAllKeys()
          keys.onsuccess = () => {
            resolve(keys.result.filter((key) => String(key).includes(id)).length)
            opening.result.close()
          }
        }
      }),
    deck,
  )

test("a deck moved to the Trash while it is open shows Deck not found, and opens again once restored", async ({
  page,
  context,
  stack,
}) => {
  const deckRoutes = await routes()
  const opened = await openDoomEditor(page, context, stack)
  await expect.poll(() => keptRows(page, opened.deck)).toBeGreaterThan(0)
  await stack.post(deckRoutes.trash.path, { deck: opened.deck }, opened.cookie)
  await expect(page.locator('[data-not-found="deck"]')).toBeVisible()
  await expect.poll(() => keptRows(page, opened.deck)).toBe(0)
  await page.reload()
  await expect(page.locator('[data-not-found="deck"]')).toBeVisible()

  await stack.post(deckRoutes.restore.path, { deck: opened.deck }, opened.cookie)
  await page.reload()
  await expect(page.locator("[data-doom-ready]")).toBeVisible()
})

test("a deck deleted for good elsewhere opens as Deck not found, not from the copy on this device", async ({
  page,
  context,
  stack,
}) => {
  const deckRoutes = await routes()
  const opened = await openDoomEditor(page, context, stack)
  await clickSlide(page, 600, 420)
  await page.keyboard.press("Enter")
  await page.keyboard.type("Kept on this device")
  await page.keyboard.press("Escape")
  await expect.poll(() => keptRows(page, opened.deck)).toBeGreaterThan(0)
  await page.goto("/")
  await stack.post(deckRoutes.trash.path, { deck: opened.deck }, opened.cookie)
  await stack.post(deckRoutes.delete.path, { decks: [opened.deck] }, opened.cookie)

  const again = await context.newPage()
  await forward(again, stack)
  const asked: string[] = []
  again.on("request", (request) => asked.push(new URL(request.url()).pathname))
  await again.clock.install()
  await again.goto(`/s/${opened.deck}`)
  await expect(again.locator('[data-not-found="deck"]')).toBeVisible()
  await expect.poll(() => keptRows(again, opened.deck)).toBe(0)
  const sinces = asked.filter((path) => path === "/doom/since").length
  await again.clock.runFor(5000)
  expect(asked.filter((path) => path === "/doom/since").length).toBe(sinces)
})

test("a trashed deck this device never opened still shows its slide on the Trash page", async ({
  page,
  context,
  stack,
}) => {
  const { deckRoutes, doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const cookie = await stack.signIn()
  const deck = crypto.randomUUID()
  await stack.post(doomRoutes.create.path, { deck }, cookie)
  await stack.post(deckRoutes.trash.path, { deck }, cookie)
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/trash")
  await expect(page.locator(`[data-deck="${deck}"] [data-doom-thumbnail]`)).toContainText("Untitled")
})
