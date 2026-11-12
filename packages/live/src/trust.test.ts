import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { deleteDatabase, distrustDevice, isTrusted, trustDeck } from "./index.js"

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

const deck = "3b6f0a52-0b6e-4a52-9d1f-6a7a2b8c1d11"
const other = "9c1d2e33-4a52-4b6e-8d1f-6a7a2b8c1d22"

it("trusts nothing the server has not confirmed on this device", async () => {
  expect(await isTrusted(deck)).toBe(false)
})

it("trusts a deck once it is confirmed, and no other deck", async () => {
  await trustDeck(deck)
  expect(await isTrusted(deck)).toBe(true)
  expect(await isTrusted(other)).toBe(false)
})

it("withdraws the trust of every deck when a person signs out", async () => {
  await trustDeck(deck)
  await trustDeck(other)
  await distrustDevice()
  expect(await isTrusted(deck)).toBe(false)
  expect(await isTrusted(other)).toBe(false)
})

it("trusts a deck again once the server confirms it after a sign-out", async () => {
  await trustDeck(deck)
  await distrustDevice()
  await trustDeck(deck)
  expect(await isTrusted(deck)).toBe(true)
  expect(await isTrusted(other)).toBe(false)
})
