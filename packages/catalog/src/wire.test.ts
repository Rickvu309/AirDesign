import { describe, expect, it } from "vitest"
import {
  catalog,
  notifyKey,
  parseNotifyKey,
  projectTools,
  readAgentEdit,
  readCapture,
  readCommit,
  readEdit,
  readWatch,
} from "./index.js"

describe("readEdit", () => {
  it("refuses an actor", () => {
    expect(readEdit({ value: "hi", actor: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a command", () => {
    expect(readEdit({ value: "hi", command: "agent" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a node outside the named pair", () => {
    expect(readEdit({ value: "hi", node: "c" })).toEqual({ ok: false, refusal: "field" })
  })

  it("keeps a named node", () => {
    expect(readEdit({ value: "hi", node: "b" })).toEqual({ ok: true, edit: { value: "hi", node: "b" } })
  })
})

describe("readCommit", () => {
  it("reads a batch of edits", () => {
    expect(readCommit({ deck: "deck", batch: [{ value: "hi" }, { value: "ho", node: "a" }] })).toEqual({
      ok: true,
      deck: "deck",
      batch: [{ value: "hi" }, { value: "ho", node: "a" }],
    })
  })

  it("refuses an actor beside the batch", () => {
    expect(readCommit({ deck: "deck", actor: "agent", batch: [{ value: "hi" }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses an empty batch", () => {
    expect(readCommit({ deck: "deck", batch: [] })).toEqual({ ok: false, refusal: "batch" })
  })

  it("refuses a batch longer than 100", () => {
    expect(readCommit({ deck: "deck", batch: Array.from({ length: 101 }, () => ({ value: "hi" })) })).toEqual({
      ok: false,
      refusal: "batch",
    })
  })
})

describe("readWatch", () => {
  it("reads a null cursor", () => {
    expect(readWatch({ deck: "deck", cursor: null })).toEqual({ ok: true, deck: "deck", cursor: null })
  })

  it("reads a zero cursor", () => {
    expect(readWatch({ deck: "deck", cursor: 0 })).toEqual({ ok: true, deck: "deck", cursor: 0 })
  })

  it("refuses a missing cursor", () => {
    const watched = readWatch({ deck: "deck" })
    expect(watched.ok).toBe(false)
    if (watched.ok) return
    expect(watched.refusal === "field" || watched.refusal === "cursor").toBe(true)
  })
})

describe("readAgentEdit", () => {
  it("reads a base and its changes", () => {
    expect(readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi" }] })).toEqual({
      ok: true,
      deck: "deck",
      base: 4,
      changes: [{ value: "hi" }],
    })
  })

  it("refuses an actor inside a change", () => {
    expect(readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", actor: "agent" }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })
})

describe("readCapture", () => {
  it("refuses a slide beside the deck", () => {
    expect(readCapture({ deck: "deck", slide: "a" })).toEqual({ ok: false, refusal: "field" })
  })

  it("reads the deck", () => {
    expect(readCapture({ deck: "deck" })).toEqual({ ok: true, deck: "deck" })
  })
})

describe("notifyKey", () => {
  it("joins the deck and the revision", () => {
    expect(notifyKey("deck", 3)).toEqual({ ok: true, key: "deck:3" })
  })

  it("refuses a key of 8000 bytes or more", () => {
    expect(notifyKey("a".repeat(8000), 0)).toEqual({ ok: false, refusal: "payload" })
  })
})

describe("parseNotifyKey", () => {
  it("reads a deck and a revision", () => {
    expect(parseNotifyKey("deck:3")).toEqual({ ok: true, deck: "deck", revision: 3 })
  })

  it("refuses a leading zero", () => {
    expect(parseNotifyKey("deck:03")).toEqual({ ok: false, refusal: "payload" })
  })
})

describe("projectTools", () => {
  it("projects the two agent tools in name order", () => {
    const tools = projectTools(catalog)
    expect(tools).toHaveLength(2)
    expect(tools.map((tool) => tool.name)).toEqual(["airdesign_capture_slide", "airdesign_edit_deck"])
    expect(tools.map((tool) => tool.runsOn)).toEqual(["device", "server"])
    expect(tools.every((tool) => tool.openWorldHint === false)).toBe(true)
  })

  it("omits a web row", () => {
    expect(
      projectTools({ commit_edits: { kind: "command", exposure: "web", runsOn: "server", description: "x" } }),
    ).toEqual([])
  })

  it("throws when an agent row omits where it runs", () => {
    expect(() => projectTools({ bad: { kind: "command", exposure: "agent", description: "x" } })).toThrow(
      "agent tool bad must say where it runs",
    )
  })
})
