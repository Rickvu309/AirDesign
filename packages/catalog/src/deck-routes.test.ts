import { unreachable } from "@airdesign/device"
import {
  decide,
  elementId,
  readRegister,
  format,
  openRegister,
  refusals,
  rootElement,
  legacyElement,
  type Command,
  type NodeRegister,
  type Register,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { deckRoutes } from "./index.js"

const payload = { ok: false, refusal: "payload" }
const revision = { ok: true, deck: "deck", revision: 0 }
const opened = { ...revision, register: openRegister("", "") }

function read(raw: unknown): Register {
  const stored = readRegister(raw)
  if (!stored.ok) throw new Error(stored.refusal)
  return stored.value
}

function firstOf(register: Register): NodeRegister {
  const body = register.elements[rootElement]
  if (body === undefined) throw new Error("missing node")
  return body
}

it("checks each list, rename and original field independently", () => {
  const row = { deck: "deck", name: "", edited: "2026-11-11", created: "2026-11-10" }
  const listed = {
    ok: true,
    account: { email: "wire@example.com" },
    decks: [row],
    trash: [{ ...row, trashed: "2026-11-11" }],
  }
  expect(deckRoutes.list.result(listed)).toEqual(listed)
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
  const signed = { ok: true, url: "https://storage.example/original", expires: "2026-11-11" }
  const uploaded = { ...signed, headers: {} }
  const original = { ...signed, sha256: "A".repeat(64), bytes: 5 }
  expect(deckRoutes.originalUpload.result(uploaded)).toEqual(uploaded)
  expect(deckRoutes.original.result(original)).toEqual(original)
  for (const changed of [{ url: null }, { expires: 1 }]) {
    expect(deckRoutes.originalUpload.result({ ...uploaded, ...changed })).toEqual(payload)
    expect(deckRoutes.original.result({ ...original, ...changed })).toEqual(payload)
  }
  expect(deckRoutes.originalUpload.result(signed)).toEqual(payload)
  for (const headers of [null, [], { length: 1 }]) {
    expect(deckRoutes.originalUpload.result({ ...uploaded, headers })).toEqual(payload)
  }
  for (const sha256 of [1, "g".repeat(64), "a".repeat(63)]) {
    expect(deckRoutes.original.result({ ...original, sha256 })).toEqual(payload)
  }
  for (const bytes of [null, -1, 0.5]) {
    expect(deckRoutes.original.result({ ...original, bytes })).toEqual(payload)
  }
})

it("decodes stored registers with agent, hidden, running, stopped and read rows", () => {
  let register = openRegister("", "")
  const commands: Command[] = [
    { command: "person", value: "person" },
    { command: "start", runId: "run" },
    { command: "agent", runId: "run", readAt: 1, value: "agent" },
    { command: "stop", runId: "run" },
    { command: "read", runId: "run", node: rootElement },
    { command: "undo", runId: "run" },
  ]
  for (const command of commands) {
    const decision = decide(register, command)
    expect(decision.decision).toBe("apply")
    if (decision.decision !== "apply") throw new Error(decision.code)
    register = decision.register
    const answer = JSON.parse(JSON.stringify({ ...revision, register }))
    expect(deckRoutes.open.result(answer)).toEqual(answer)
  }
  expect(firstOf(register).landed).toEqual([
    { actor: "person", value: "person", visible: true },
    { actor: "agent", value: "agent", visible: false, runId: "run" },
  ])
  expect(firstOf(register).readAt).toBe(1)
  expect(register.readNodes).toEqual([rootElement])
})

function stored(commands: Command[]) {
  let register = openRegister("", "")
  for (const command of commands) {
    const decision = decide(register, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    register = decision.register
  }
  return register
}

it("decodes a stored register whose landed value is empty", () => {
  const register = stored([{ command: "person", value: "" }])
  expect(firstOf(register).landed).toEqual([{ actor: "person", value: "", visible: true }])
  const answer = JSON.parse(JSON.stringify({ ...revision, register }))
  expect(deckRoutes.open.result(answer)).toEqual(answer)
})

it("decodes a stored register guarded by a person edit during a run", () => {
  const register = stored([
    { command: "start", runId: "run" },
    { command: "person", value: "person" },
  ])
  expect(firstOf(register).guarded).toBe(true)
  const answer = JSON.parse(JSON.stringify({ ...revision, register }))
  expect(deckRoutes.open.result(answer)).toEqual(answer)
})

it("decodes a stored register that counts slides and bytes", () => {
  const answer = JSON.parse(JSON.stringify({ ...revision, register: { ...openRegister("", ""), slides: 3, bytes: 5 } }))
  expect(deckRoutes.open.result(answer)).toEqual(answer)
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
    "open",
    "commit",
    "index",
    "watch",
    "list",
    "rename",
    "star",
    "trash",
    "restore",
    "delete",
    "originalUpload",
    "originalDone",
    "original",
    "mediaUpload",
    "media",
    "undo",
    "findings",
  ])
})

it("refuses missing and malformed success fields for every deck route", () => {
  const wrong = {
    open: [{ ...revision }, { ...opened, register: null }],
    commit: [{ ...revision }, { ...revision, key: "deck:9" }],
    index: [{ ok: true }, { ...revision, revision: -1 }],
    watch: [
      { ...revision, revision: 0.5 },
      { ...revision, deck: "bad deck" },
    ],
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
    originalUpload: [{ ok: true }, { ok: true, url: "url", expires: "date", headers: { length: 1 } }],
    originalDone: [null, { ok: "true" }],
    original: [{ ok: true }, { ok: true, url: "url", expires: "date", bytes: -1, sha256: "a" }],
    mediaUpload: [{ ok: true }, { ok: true, url: "url", expires: "date", headers: { length: 1 } }],
    media: [{ ok: true }, { ok: true, url: "url", expires: "date", bytes: 1, sha256: "a" }],
    undo: [{ ...revision }, { ...revision, key: "deck:9" }],
    findings: [{ ok: true }, { ok: true, deck: "bad deck" }],
  } satisfies Record<keyof typeof deckRoutes, unknown[]>
  for (const [name, route] of Object.entries(deckRoutes)) {
    const cases = Object.entries(wrong).find(([key]) => key === name)?.[1] ?? []
    for (const raw of cases) expect(route.result(raw)).toEqual(payload)
  }
})

it("checks every register field and nested landed row before opening", () => {
  const register = { ...opened.register, ...firstOf(opened.register) }
  expect(deckRoutes.open.result({ ...opened, register })).toEqual({ ...opened, register: read(register) })
  const bad = {
    route: null,
    floor: 1,
    landed: [{}],
    version: -1,
    phase: "unknown",
    runId: 1,
    readAt: -1,
    guarded: null,
    claimed: 0.5,
    stoppedAt: -1,
    slides: -1,
    bytes: "0",
    nodes: ["bad"],
    readNodes: ["bad"],
    elements: { bad: register },
    b: {},
    file: ["slide"],
  }
  expect(deckRoutes.open.result({ ...opened, register: { ...register, order: [{ slide: "nope" }] } })).toEqual({
    ok: false,
    refusal: "newer",
  })
  for (const [key, value] of Object.entries(bad)) {
    expect(deckRoutes.open.result({ ...opened, register: { ...register, [key]: value } })).toEqual(payload)
  }
  for (const row of [
    { actor: "owner", value: "", visible: true },
    { actor: "person", value: 1, visible: true },
    { actor: "person", value: "", visible: null },
    { actor: "agent", value: "", visible: true, runId: 1 },
  ]) {
    expect(deckRoutes.open.result({ ...opened, register: { ...register, landed: [row] } })).toEqual(payload)
  }
  expect(
    deckRoutes.open.result({ ...opened, register: { ...register, elements: { "258.7": { ...register, floor: 1 } } } }),
  ).toEqual(payload)
})

it("accepts root, legacy, removed and current register elements and folds the root ones into the map", () => {
  const first = firstOf(openRegister("", ""))
  const kept = firstOf(openRegister("floor", "route"))
  const legacy = firstOf(openRegister("legacy", ""))
  const register = {
    ...openRegister("", ""),
    ...first,
    nodes: [rootElement, legacyElement, elementId("258.7")],
    readNodes: [rootElement],
    elements: { "258.7": kept, "258.8": first },
    b: legacy,
  }
  const answer = { ...revision, register }
  expect(deckRoutes.open.result(answer)).toEqual({ ...revision, register: read(register) })
  expect(read(register).elements).toEqual({
    "258.7": kept,
    "258.8": first,
    [legacyElement]: legacy,
    [rootElement]: { ...first, version: 0 },
  })
  const current = read(register)
  expect(deckRoutes.open.result({ ...revision, register: current })).toEqual({ ...revision, register: current })
  expect(deckRoutes.open.result({ ...revision, register: { ...current, b: legacy } })).toEqual({
    ...revision,
    register: current,
  })
})

it("decodes the runs a register records ended, and refuses a record that is not a list of run ids", () => {
  const answer = { ...revision, register: { ...openRegister("", ""), ended: ["run"] } }
  expect(deckRoutes.open.result(JSON.parse(JSON.stringify(answer)))).toEqual(answer)
  expect(deckRoutes.open.result({ ...answer, register: { ...answer.register, ended: [1] } })).toEqual(payload)
  expect(deckRoutes.open.result({ ...answer, register: { ...answer.register, ended: "run" } })).toEqual(payload)
})

it("decodes the run a register records as its last writer, and refuses a record that is not one", () => {
  const answer = {
    ...revision,
    register: { ...openRegister("", ""), lastRun: { runId: "run", since: 2, revision: 4 } },
  }
  expect(deckRoutes.open.result(JSON.parse(JSON.stringify(answer)))).toEqual(answer)
  for (const lastRun of [
    "run",
    { runId: 1, since: 2, revision: 4 },
    { runId: "run", since: -1, revision: 4 },
    { runId: "run", since: 2 },
  ])
    expect(deckRoutes.open.result({ ...answer, register: { ...answer.register, lastRun } })).toEqual(payload)
})

it("decodes an open answer whose register says a newer format as newer", () => {
  expect(deckRoutes.open.result({ ...opened, register: { ...opened.register, format: format + 1 } })).toEqual({
    ok: false,
    refusal: "newer",
  })
})
