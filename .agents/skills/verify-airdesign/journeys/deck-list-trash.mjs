import path from "node:path"
import { expect } from "@playwright/test"

export default async function drive({ repo, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect
    .poll(async () => (await post(deckRoutes.list, {}, cookie)).json.decks?.find((entry) => entry.deck === deck)?.name)
    .toBe("clean")
  note(`imported clean.pptx as deck ${deck}; ${deckRoutes.list.path} names it clean`)
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "clean", exact: true })).toBeVisible()
  await capture("home-lists-deck")
  await page.getByRole("button", { name: "Move to Trash" }).click()
  await expect(page.getByText("clean moved to Trash", { exact: true })).toBeVisible()
  await capture("moved-to-trash")
  await expect
    .poll(async () => (await post(deckRoutes.list, {}, cookie)).json.trash?.map((entry) => entry.deck))
    .toContain(deck)
  note(`after Move to Trash, ${deckRoutes.list.path} shows ${deck} in trash`)
  await page.goto("/trash")
  await expect(page.getByRole("heading", { name: "clean", exact: true })).toBeVisible()
  await capture("trash-lists-deck")
  await page.getByRole("button", { name: "Restore", exact: true }).click()
  await expect(page.getByRole("heading", { name: "clean", exact: true })).toHaveCount(0)
  await expect
    .poll(async () => (await post(deckRoutes.list, {}, cookie)).json.decks?.map((entry) => entry.deck))
    .toContain(deck)
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "clean", exact: true })).toBeVisible()
  await capture("restored")
  note(`after Restore on /trash, ${deckRoutes.list.path} lists ${deck} again and Home shows it`)
}
