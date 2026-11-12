import type { Page } from "@playwright/test"
import { openRegister } from "../../packages/document/src/index.ts"

export type Deck = { deck: string; name: string; edited: string; created: string; trashed?: string }
export const now = "2026-11-11T12:00:00Z"
export const first: Deck = { deck: "first", name: "Real presentation", edited: now, created: "2026-10-30T12:00:00Z" }
export const second: Deck = { ...first, deck: "second", name: "Another presentation", edited: "2026-11-11T10:00:00Z" }

export async function store(page: Page, decks: Deck[] = [first, second], trash: Deck[] = []) {
  const state = { decks: structuredClone(decks), trash: structuredClone(trash) }
  const calls: { path: string; body: Record<string, unknown> }[] = []
  await page.clock.install({ time: new Date(now) })
  await page.route("**/decks/*", async (route) => {
    const path = new URL(route.request().url()).pathname.split("/").at(-1) ?? ""
    const body = route.request().postDataJSON() as Record<string, unknown>
    calls.push({ path, body })
    if (path === "list") {
      await route.fulfill({ json: { ok: true, account: { email: "home@example.com" }, ...state } })
      return
    }
    if (path === "open") {
      await route.fulfill({ json: { ok: true, deck: body.deck, revision: 0, register: openRegister("", "") } })
      return
    }
    if (path === "trash") {
      const deck = state.decks.find((deck) => deck.deck === body.deck)
      state.decks = state.decks.filter((deck) => deck.deck !== body.deck)
      if (deck) state.trash.push({ ...deck, trashed: now })
    }
    if (path === "restore") {
      const deck = state.trash.find((deck) => deck.deck === body.deck)
      state.trash = state.trash.filter((deck) => deck.deck !== body.deck)
      if (deck) state.decks.push(deck)
    }
    if (path === "delete") {
      state.trash = state.trash.filter((deck) => !(body.decks as string[]).includes(deck.deck))
    }
    await route.fulfill({ json: { ok: true } })
  })
  return { state, calls }
}

export const many: Deck[] = Array.from({ length: 8 }, (_, index) => ({
  ...first,
  deck: `deck-${index}`,
  name: `Deck ${index}`,
  edited: new Date(Date.UTC(2026, 10, 1 + index, 9)).toISOString(),
}))
