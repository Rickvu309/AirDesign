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

  it("refuses a principal", () => {
    expect(readEdit({ value: "hi", principal: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a person", () => {
    expect(readEdit({ value: "hi", person: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses an agent", () => {
    expect(readEdit({ value: "hi", agent: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a surface", () => {
    expect(readEdit({ value: "hi", surface: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses an onBehalfOf", () => {
    expect(readEdit({ value: "hi", onBehalfOf: "person" })).toEqual({ ok: false, refusal: "field" })
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

  it("reads a batch of 100", () => {
    const batch = Array.from({ length: 100 }, () => ({ value: "hi" }))
    expect(readCommit({ deck: "deck", batch })).toEqual({ ok: true, deck: "deck", batch })
  })

  it("refuses a batch longer than 100", () => {
    expect(readCommit({ deck: "deck", batch: Array.from({ length: 101 }, () => ({ value: "hi" })) })).toEqual({
      ok: false,
      refusal: "batch",
    })
  })

  it("refuses a once that is not 1 to 64 safe characters", () => {
    const batch = [{ value: "hi" }]
    const fit = "a".repeat(64)
    expect(readCommit({ deck: "deck", batch, once: "a".repeat(65) })).toEqual({ ok: false, refusal: "field" })
    expect(readCommit({ deck: "deck", batch, once: "" })).toEqual({ ok: false, refusal: "field" })
    expect(readCommit({ deck: "deck", batch, once: 1 })).toEqual({ ok: false, refusal: "field" })
    expect(readCommit({ deck: "deck", batch, once: "bad once" })).toEqual({ ok: false, refusal: "field" })
    expect(readCommit({ deck: "deck", batch, once: fit })).toEqual({ ok: true, deck: "deck", batch, once: fit })
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

  it("refuses a fractional revision", () => {
    expect(notifyKey("deck", 1.5)).toEqual({ ok: false, refusal: "payload" })
  })
})

describe("parseNotifyKey", () => {
  it("reads a deck and a revision", () => {
    expect(parseNotifyKey("deck:3")).toEqual({ ok: true, deck: "deck", revision: 3 })
  })

  it("refuses a leading zero", () => {
    expect(parseNotifyKey("deck:03")).toEqual({ ok: false, refusal: "payload" })
  })

  it("refuses a fractional revision", () => {
    expect(parseNotifyKey("deck:1.5")).toEqual({ ok: false, refusal: "payload" })
  })
})

describe("projectTools", () => {
  it("projects the two agent tools in name order", () => {
    const tools = projectTools(catalog)
    expect(tools).toHaveLength(2)
    expect(tools.map((tool) => tool.name)).toEqual(["airdesign_capture_slide", "airdesign_edit_deck"])
    expect(tools.map((tool) => tool.runsOn)).toEqual(["device", "server"])
    expect(tools.every((tool) => tool.openWorldHint === false)).toBe(true)
    const edit = tools.find((tool) => tool.name === "airdesign_edit_deck")
    const capture = tools.find((tool) => tool.name === "airdesign_capture_slide")
    expect(edit).toEqual({
      name: "airdesign_edit_deck",
      op: "edit_deck",
      description: "Write values on one deck. The server names the actor.",
      runsOn: "server",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    })
    expect(capture).toEqual({
      name: "airdesign_capture_slide",
      op: "capture_slide",
      description: "Render one slide in the person's open tab.",
      runsOn: "device",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    })
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
