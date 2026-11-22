import { expect, type Page } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { test, forward, signInBrowser } from "./api-stack"
import { newDoomDeck } from "./new-deck"
import { clickSlide, savedNode } from "./scene-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const titleNode = "s:4"

async function typeTitle(page: Page, text: string) {
  await clickSlide(page, 600, 420)
  await page.keyboard.press("Enter")
  await page.keyboard.type(text)
  await page.keyboard.press("Escape")
}

test("a new deck opens as a scene deck, and the home lists it with its name and a thumbnail of its slide", async ({
  page,
  context,
  stack,
}) => {
  const faults: string[] = []
  page.on("pageerror", (error) => faults.push(error.message))
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/")
  await newDoomDeck(page)
  await page.locator("[data-scene-ready]").waitFor()
  await expect(page).toHaveURL(/\/s\/[A-Za-z0-9_-]{1,64}$/)
  const deck = new URL(page.url()).pathname.slice("/s/".length)

  await typeTitle(page, "Quarterly review")
  const opened = { deck, cookie, slide: "s:3" }
  await expect
    .poll(async () => ((await savedNode(stack, opened, titleNode))?.text as { chars: string } | undefined)?.chars)
    .toBe("Quarterly review")

  await page.getByRole("link", { name: productCopy.goToDecks }).click()
  const card = page.locator(`[data-deck="${deck}"]`)
  await expect(card).toBeVisible()
  await expect(card.getByRole("heading")).toHaveText(productCopy.blankDeck)
  await expect(card.locator("[data-scene-thumbnail]")).toContainText("Quarterly review")
  await expect(card.locator("[data-scene-slide]")).toHaveCount(1)

  await card.getByRole("link").click()
  await expect(page).toHaveURL(new RegExp(`/s/${deck}$`))
  await page.locator("[data-scene-ready]").waitFor()
  await expect(page.locator("[data-slide-box]")).toContainText("Quarterly review")
  expect(faults).toEqual([])
})

test("a scene deck moves to the Trash and comes back from the home, and its thumbnail paints from the copy on the device", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/")
  await newDoomDeck(page)
  await page.locator("[data-scene-ready]").waitFor()
  const deck = new URL(page.url()).pathname.slice("/s/".length)
  await page.goto("/")
  const card = page.locator(`[data-deck="${deck}"]`)
  await expect(card.locator("[data-scene-thumbnail]")).toContainText("Untitled")

  const { sceneRoutes } = await import("../../packages/catalog/src/index.ts")
  const deckReads: string[] = []
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (path === sceneRoutes.open.path || path === sceneRoutes.since.path) deckReads.push(path)
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
  await expect(page.locator(`[data-deck="${deck}"] [data-scene-thumbnail]`)).toContainText("Untitled")
  expect(deckReads).toEqual([])
})
