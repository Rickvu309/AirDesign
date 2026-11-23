import { unreachable } from "@airdesign/device"
import { refusals } from "@airdesign/document"
import { expect, it } from "vitest"
import { deckRoutes } from "./index.js"

const payload = { ok: false, refusal: "payload" }

it("checks each list, rename and media field independently", () => {
  const row = { deck: "deck", name: "", edited: "2026-11-11", created: "2026-11-10", doom: { rev: 3 } }
  const listed = {
    ok: true,
    account: { email: "wire@example.com" },
    decks: [row],
    trash: [{ ...row, trashed: "2026-11-11" }],
  }
  expect(deckRoutes.list.result(listed)).toEqual(listed)
  expect(deckRoutes.list.result({ ...listed, decks: [{ ...row, doom: undefined }] })).toEqual(payload)
  expect(deckRoutes.list.result({ ...listed, decks: [{ ...row, doom: "yes" }] })).toEqual(payload)
  expect(deckRoutes.list.result({ ...listed, decks: [{ ...row, doom: true }] })).toEqual(payload)
  expect(deckRoutes.list.result({ ...listed, decks: [{ ...row, doom: { rev: -1 } }] })).toEqual(payload)
  for (const [field, value] of Object.entries({ deck: "bad deck", name: 1, edited: null, created: 1 })) {
    expect(deckRoutes.list.result({ ...listed, decks: [{ ...row, [field]: value }] })).toEqual(payload)
    expect(deckRoutes.list.result({ ...listed, trash: [{ ...listed.trash[0], [field]: value }] })).toEqual(payload)
  }
  for (const changed of [
    { account: null },
    { account: { email: 1 } },
    { decks: null },
    { trash: null },
    { trash: [row] },
    { trash: [{ ...row, trashed: 1 }] },
  ])
    expect(deckRoutes.list.result({ ...listed, ...changed })).toEqual(payload)
  const renamed = { ok: true, deck: "deck", name: "" }
  expect(deckRoutes.rename.result(renamed)).toEqual(renamed)
  expect(deckRoutes.rename.result({ ...renamed, deck: "bad deck" })).toEqual(payload)
  expect(deckRoutes.rename.result({ ...renamed, name: null })).toEqual(payload)
  const deleted = { ok: true, deleted: [] }
  expect(deckRoutes.delete.result(deleted)).toEqual(deleted)
  const signed = { ok: true, url: "https://storage.example/media", expires: "2026-11-11" }
  const uploaded = { ...signed, headers: {} }
  const stored = { ...signed, sha256: "A".repeat(64), bytes: 5 }
  expect(deckRoutes.mediaUpload.result(uploaded)).toEqual(uploaded)
  expect(deckRoutes.media.result(stored)).toEqual(stored)
  for (const changed of [{ url: null }, { expires: 1 }]) {
    expect(deckRoutes.mediaUpload.result({ ...uploaded, ...changed })).toEqual(payload)
    expect(deckRoutes.media.result({ ...stored, ...changed })).toEqual(payload)
  }
  expect(deckRoutes.mediaUpload.result(signed)).toEqual(payload)
  for (const headers of [null, [], { length: 1 }]) {
    expect(deckRoutes.mediaUpload.result({ ...uploaded, headers })).toEqual(payload)
  }
  for (const sha256 of [1, "g".repeat(64), "a".repeat(63)]) {
    expect(deckRoutes.media.result({ ...stored, sha256 })).toEqual(payload)
  }
  for (const bytes of [null, -1, 0.5]) {
    expect(deckRoutes.media.result({ ...stored, bytes })).toEqual(payload)
  }
})

it("refuses malformed answer envelopes for every deck route", () => {
  for (const route of Object.values(deckRoutes)) {
    for (const raw of [null, [], "answer", 1, {}, { ok: "true" }, { ok: false }, { ok: false, refusal: "unknown" }]) {
      expect(route.result(raw)).toEqual(payload)
    }
    expect(route.result({ ok: false, refusal: "owner" })).toEqual({ ok: false, refusal: "owner" })
  }
})

it("decodes every code document refuses with and every code device cannot reach with", () => {
  for (const route of Object.values(deckRoutes)) {
    for (const refusal of [...refusals, ...unreachable]) {
      expect(route.result({ ok: false, refusal })).toEqual({ ok: false, refusal })
    }
  }
})

it("decodes deleted on every deck route", () => {
  for (const route of Object.values(deckRoutes)) {
    expect(route.result({ ok: false, refusal: "deleted" })).toEqual({ ok: false, refusal: "deleted" })
  }
  expect(Object.keys(deckRoutes)).toEqual([
    "list",
    "rename",
    "star",
    "trash",
    "restore",
    "delete",
    "mediaUpload",
    "media",
  ])
})

it("refuses missing and malformed success fields for every deck route", () => {
  const wrong = {
    list: [{ ok: true }, { ok: true, account: { email: "a" }, decks: [{}], trash: [] }],
    rename: [
      { ok: true, deck: "deck" },
      { ok: true, deck: "deck", name: 1 },
    ],
    star: [
      { ok: true, deck: "deck" },
      { ok: true, deck: "deck", starred: "yes" },
    ],
    trash: [
      { ok: true, deck: "deck" },
      { ok: true, deck: "deck", trashed: null },
    ],
    restore: [{ ok: true }, { ok: true, deck: "bad deck" }],
    delete: [{ ok: true }, { ok: true, deleted: ["bad deck"] }],
    mediaUpload: [{ ok: true }, { ok: true, url: "url", expires: "date", headers: { length: 1 } }],
    media: [{ ok: true }, { ok: true, url: "url", expires: "date", bytes: 1, sha256: "a" }],
  } satisfies Record<keyof typeof deckRoutes, unknown[]>
  for (const [name, route] of Object.entries(deckRoutes)) {
    const cases = Object.entries(wrong).find(([key]) => key === name)?.[1] ?? []
    for (const raw of cases) expect(route.result(raw)).toEqual(payload)
  }
})
