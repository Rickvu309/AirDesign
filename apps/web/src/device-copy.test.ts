import { beforeEach, expect, it, vi } from "vitest"

const live = vi.hoisted(() => ({
  stored: { ok: false } as { ok: boolean; parts?: Map<string, Uint8Array> },
  original: { ok: false, refusal: "missing" } as { ok: boolean; refusal?: string; file?: Uint8Array },
  asked: 0,
}))

vi.mock("@airdesign/live", () => ({
  getParts: async () => live.stored,
  putParts: async () => ({ ok: false }),
  adoptDeck: async () => false,
  connect: () => ({ openDeck: async () => ({ ok: false }) }),
  memoryRemote: () => ({}),
  fetchOriginal: async () => {
    live.asked += 1
    return live.original
  },
}))

import { deckParts } from "./device-copy"

beforeEach(() => {
  live.stored = { ok: false }
  live.original = { ok: false, refusal: "missing" }
  live.asked = 0
})

it("answers signed-out when the server refuses the original because there is no session", async () => {
  live.original = { ok: false, refusal: "session" }
  expect(await deckParts("deck-one")).toBe("signed-out")
})

it("answers refused when the server has no deck of the person's to open", async () => {
  for (const refusal of ["owner", "deleted", "deck", "missing"]) {
    live.original = { ok: false, refusal }
    expect(await deckParts("deck-one")).toBe("refused")
  }
})

it("answers nothing when the original cannot be fetched, so the failure notice shows", async () => {
  for (const refusal of ["storage", "server"]) {
    live.original = { ok: false, refusal }
    expect(await deckParts("deck-one")).toBeNull()
  }
})

it("opens from the device without asking the server when the parts are there", async () => {
  live.stored = { ok: true, parts: new Map() }
  expect(await deckParts("deck-one")).toBe(live.stored)
  expect(live.asked).toBe(0)
})
