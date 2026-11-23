import { productCopy } from "../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { newDoomDeck } from "../bin/new-deck.mjs"

const named = "Quarterly review"

async function newDeck(page, post, deckRoutes, cookie) {
  await page.goto("/")
  await newDoomDeck(page)
  const deck = new URL(page.url()).pathname.match(/[A-Za-z0-9_-]+$/)[0]
  await expect
    .poll(async () => (await post(deckRoutes.list, {}, cookie)).json.decks?.find((entry) => entry.deck === deck)?.doom)
    .toBeDefined()
  return deck
}

export default async function drive({ page, signIn, post, capture, note, deckRoutes }) {
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  const deck = await newDeck(page, post, deckRoutes, cookie)
  await page.getByRole("button", { name: /^Rename deck:/ }).click()
  const field = page.getByRole("textbox", { name: productCopy.deckName })
  await field.fill(named)
  await field.press("Enter")
  await expect
    .poll(async () => (await post(deckRoutes.list, {}, cookie)).json.decks?.find((entry) => entry.deck === deck)?.name)
    .toBe(named)
  note(`New deck opened doom deck ${deck}; renamed in the editor, ${deckRoutes.list.path} names it ${named}`)
  const blank = await newDeck(page, post, deckRoutes, cookie)
  note(`New deck opened a second doom deck ${blank}; ${deckRoutes.list.path} lists it with its revision`)
  await page.goto("/")
  await expect(page.locator(`[data-deck="${blank}"] [data-doom-thumbnail]`)).toBeVisible()
  await expect(page.locator(`[data-deck="${deck}"] [data-doom-thumbnail]`)).toBeVisible()
  await expect(page.getByRole("heading", { name: named, exact: true })).toBeVisible()
  await capture("home-lists-deck")
  await page.getByRole("button", { name: `${named} actions` }).click()
  await page.getByRole("menuitem", { name: "Move to Trash" }).click()
  await expect(page.getByText(`${named} moved to Trash`, { exact: true })).toBeVisible()
  await capture("moved-to-trash")
  await expect
    .poll(async () => (await post(deckRoutes.list, {}, cookie)).json.trash?.map((entry) => entry.deck))
    .toContain(deck)
  note(`after Move to Trash, ${deckRoutes.list.path} shows ${deck} in trash`)
  await page.goto("/trash")
  await expect(page.getByRole("heading", { name: named, exact: true })).toBeVisible()
  await capture("trash-lists-deck")
  await page.getByRole("button", { name: "Restore", exact: true }).click()
  await expect(page.getByRole("heading", { name: named, exact: true })).toHaveCount(0)
  await expect
    .poll(async () => (await post(deckRoutes.list, {}, cookie)).json.decks?.map((entry) => entry.deck))
    .toContain(deck)
  await page.goto("/")
  await expect(page.getByRole("heading", { name: named, exact: true })).toBeVisible()
  await capture("restored")
  note(`after Restore on /trash, ${deckRoutes.list.path} lists ${deck} again and Home shows it`)
}
