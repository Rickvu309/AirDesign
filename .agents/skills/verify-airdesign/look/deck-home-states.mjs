import path from "node:path"
import { expect } from "@playwright/test"

const editor = "/screens/s42-02-editor-agent-run-complete"

async function fixtureDeck(kit) {
  const { openDeck } = await import("./states.mjs")
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
}

async function listing(kit, names) {
  await kit.signIn()
  const base = Date.now()
  const decks = names.map((name, index) => {
    const when = new Date(base - index * 86400000).toISOString()
    return { deck: `deck-${index}`, name, edited: when, created: when }
  })
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.list.path,
    (route) => route.fulfill({ json: { ok: true, account: { email: "person@example.com" }, decks, trash: [] } }),
  )
}

const names = [
  "Project Atlas",
  "Q3 Investor Update",
  "FY26 Operating Plan",
  "Pricing Strategy Review",
  "Board Pack, October",
  "Germany Market Sizing",
  "Hiring Plan",
  "Brand Refresh",
]

async function allDecks(kit) {
  await listing(kit, names)
  await kit.page.goto("/all")
  await expect(kit.page.getByRole("heading", { name: "All decks", level: 1 })).toBeVisible()
  await expect(kit.page.getByRole("heading", { name: "Brand Refresh", level: 2 })).toBeVisible()
}

async function searchMatch(kit) {
  await listing(kit, names)
  await kit.page.goto("/?q=plan")
  await expect(kit.page.getByRole("heading", { name: "Hiring Plan", level: 2 })).toBeVisible()
}

async function searchEmpty(kit) {
  await listing(kit, names)
  await kit.page.goto("/?q=quarterly")
  await expect(kit.page.getByRole("heading", { name: "No decks match “quarterly”" })).toBeVisible()
}

async function renaming(kit) {
  await fixtureDeck(kit)
  await kit.page.getByRole("button", { name: "Rename deck: clean" }).click()
  await expect(kit.page.getByRole("textbox", { name: "Deck name" })).toBeFocused()
}

async function renameRefused(kit) {
  await renaming(kit)
  const field = kit.page.getByRole("textbox", { name: "Deck name" })
  await field.fill("")
  await field.press("Enter")
  await expect(kit.page.getByRole("alert")).toHaveText("Enter a name for this deck.")
}

async function downloaded(kit) {
  await fixtureDeck(kit)
  const saving = kit.page.waitForEvent("download")
  await kit.page.getByRole("button", { name: "Export" }).click()
  await saving
  await expect(kit.page.getByText("clean.pptx downloaded", { exact: true })).toBeVisible()
}

export const deckHomeStates = [
  { name: "decks-all", design: "/screens/s31-04-decks-browse-all-decks-grid", drive: allDecks },
  { name: "decks-search-match", design: "/screens/s31-02-decks-browse-recents-grid", drive: searchMatch },
  { name: "decks-search-empty", design: null, drive: searchEmpty },
  { name: "editor-renaming", design: editor, drive: renaming },
  { name: "editor-rename-refused", design: editor, drive: renameRefused },
  { name: "export-downloaded", design: "/screens/s61-03-export-export-downloaded-toast", drive: downloaded },
]
