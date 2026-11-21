import { readFile } from "node:fs/promises"
import { expect } from "@playwright/test"
import { notesCopy } from "../../apps/web/src/copy/notes-copy.ts"
import { readDeviceRows } from "./deck-state"
import { deckStateFile } from "../../scripts/deck-state-file.mjs"
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

test("a failed test that opened no page of the app attaches nothing", async ({ deckState }, testInfo) => {
  const attached: string[] = []
  await deckState.attach({
    status: "failed",
    outputPath: (...segments) => testInfo.outputPath(...segments),
    attach: async (name) => {
      attached.push(name)
    },
  })
  expect(attached).toEqual([])
})

test("a failed test that opened a deck attaches the device's rows and the server's for it", async ({
  decks,
  deckState,
}, testInfo) => {
  const deck = await decks.open()
  const kept: { name: string; path?: string }[] = []
  await deckState.attach({
    status: "failed",
    outputPath: (...segments) => testInfo.outputPath(...segments),
    attach: async (name, options) => {
      kept.push({ name, path: options?.path })
    },
  })
  expect(kept.map((each) => each.name)).toEqual([deckStateFile])
  const state = JSON.parse(await readFile(kept[0]?.path ?? "", "utf8")) as { server: { deck: string }[] }
  expect(state.server.map((each) => each.deck)).toEqual([deck])
})
