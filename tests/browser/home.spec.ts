import { expect, type Page } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { test, forward, signInBrowser } from "./api-stack"
import { newDoomDeck } from "./new-deck"
import { clickSlide, savedNode } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const titleNode = "s:4"

async function typeTitle(page: Page, text: string) {
  await clickSlide(page, 600, 490)
  await page.keyboard.press("Enter")
  await page.keyboard.type(text)
  await page.keyboard.press("Escape")
}

test("a new deck opens as a doom deck, and the home lists it with its name and a thumbnail of its slide", async ({
  page,
  context,
  stack,
}) => {
  const fontEngineRequests: string[] = []
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (/\.wasm$|\/layout-[\w-]{8}\.js$|font-layout-licenses/.test(path)) fontEngineRequests.push(path)
  })
  const faults: string[] = []
  page.on("pageerror", (error) => faults.push(error.message))
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/")
  expect(fontEngineRequests).toEqual([])
  await newDoomDeck(page)
  await page.locator("[data-editor-ready]").waitFor()
  await expect(page).toHaveURL(/\/s\/[A-Za-z0-9_-]{1,64}(\?node-id=.*)?$/)
  const deck = new URL(page.url()).pathname.slice("/s/".length)

  const first = "Quarterly review"
  await typeTitle(page, first)
  const opened = { deck, cookie, slide: "s:3" }
  await expect
    .poll(async () => ((await savedNode(stack, opened, titleNode))?.text as { chars: string } | undefined)?.chars)
    .toBe(first)

  await page.getByRole("link", { name: productCopy.goToDecks }).click()
  const card = page.locator(`[data-deck="${deck}"]`)
  await expect(card).toBeVisible()
  await expect(card.getByRole("heading")).toHaveText(first)
  await expect(card.locator("[data-deck-thumbnail]")).toContainText("Quarterly review")
  await expect(card.locator("[data-doom-slide]")).toHaveCount(1)

  await card.getByRole("link").click()
  await expect(page).toHaveURL(new RegExp(`/s/${deck}(\\?node-id=.*)?$`))
  await page.locator("[data-editor-ready]").waitFor()
  await expect(page.locator("[data-slide-box]")).toContainText("Quarterly review")
  expect(faults).toEqual([])
  expect(fontEngineRequests.some((path) => /\/icu-breaks-.*\.wasm$/.test(path))).toBe(true)
})

test("a doom deck moves to the Trash and comes back from the home, and its thumbnail paints from the copy on the device", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/")
  await newDoomDeck(page)
  await page.locator("[data-editor-ready]").waitFor()
  const deck = new URL(page.url()).pathname.slice("/s/".length)
  await page.goto("/")
  const card = page.locator(`[data-deck="${deck}"]`)
  await expect(card.locator("[data-deck-thumbnail]")).toContainText("Untitled")

  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const deckReads: string[] = []
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (path === doomRoutes.open.path || path === doomRoutes.since.path) deckReads.push(path)
  })
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).focus()
  await card.getByRole("button", { name: /actions/i }).click()
  await page.getByRole("menuitem", { name: productCopy.moveToTrash }).click()
  await expect(card).toHaveCount(0)

  await page.getByRole("link", { name: "Trash" }).click()
  const trashed = page.locator(`[data-deck="${deck}"]`)
  await expect(trashed).toBeVisible()
  await trashed.getByRole("button", { name: /restore/i }).click()
  await expect(trashed).toHaveCount(0)
  await page.getByRole("link", { name: "Recents" }).click()
  await expect(page.locator(`[data-deck="${deck}"] [data-deck-thumbnail]`)).toContainText("Untitled")
  expect(deckReads).toEqual([])
})

test("Escape while an IME composes in the deck search, as it cancels a conversion in Chrome and in Safari, keeps the query, and a plain Escape then clears it", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/")
  const search = page.getByRole("searchbox", { name: "Search" })
  await search.click()
  await page.keyboard.type("sales")
  await search.evaluate((field) =>
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true, cancelable: true }),
    ),
  )
  await expect(search).toHaveValue("sales")
  await search.evaluate((field) =>
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 229, bubbles: true, cancelable: true })),
  )
  await expect(search).toHaveValue("sales")
  await page.keyboard.press("Escape")
  await expect(search).toHaveValue("")
})
