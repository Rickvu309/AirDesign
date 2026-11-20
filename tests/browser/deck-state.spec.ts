import { expect } from "@playwright/test"
import { notesCopy } from "../../apps/web/src/copy/notes-copy.ts"
import { readDeviceRows } from "./deck-state"
import { test } from "./deck-test"

const typed = "Keep this line through the reload."

test("keeps in memory the device rows a reloaded deck page finds before its own code runs, its typed row among them", async ({
  page,
  decks,
  deckState,
}) => {
  const deck = await decks.open()
  const field = page.getByRole("textbox", { name: notesCopy.value, exact: true })
  await field.click()
  await page.keyboard.type(typed)
  const holding = async () => {
    const rows = await readDeviceRows(page)
    const own = rows.decks.find((each) => each.deck === deck)
    return JSON.stringify([...(own?.pending ?? []), ...(own?.confirmed ?? [])]).includes(typed)
  }
  await expect.poll(holding).toBe(true)
  expect(deckState.loads().map((each) => each.navigation)).toEqual(["navigate"])
  await page.reload()
  await decks.ready()
  await expect.poll(() => deckState.loads().map((each) => each.navigation)).toEqual(["navigate", "reload"])
  const load = deckState.loads().at(-1)
  expect(load?.url.endsWith(`/deck/${deck}`)).toBe(true)
  const kept = load === undefined || "error" in load.rows ? [] : load.rows.decks
  const own = kept.find((each) => each.deck === deck)
  expect(JSON.stringify([...(own?.pending ?? []), ...(own?.confirmed ?? [])])).toContain(typed)
  await expect.poll(holding).toBe(true)
})
