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
  readNode,
  readRun,
  readRunStart,
  readWatch,
} from "./index.js"

describe("readEdit", () => {
  it("refuses an actor", () => {
    expect(readEdit({ value: "hi", node: "258.7", actor: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a command", () => {
    expect(readEdit({ value: "hi", node: "258.7", command: "agent" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a principal", () => {
    expect(readEdit({ value: "hi", node: "258.7", principal: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a person", () => {
    expect(readEdit({ value: "hi", node: "258.7", person: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses an agent", () => {
    expect(readEdit({ value: "hi", node: "258.7", agent: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a surface", () => {
    expect(readEdit({ value: "hi", node: "258.7", surface: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses an onBehalfOf", () => {
    expect(readEdit({ value: "hi", node: "258.7", onBehalfOf: "person" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a node outside the named pair", () => {
    expect(readEdit({ value: "hi", node: "c" })).toEqual({ ok: false, refusal: "field" })
    expect(readEdit({ value: "hi", node: "a" })).toEqual({ ok: false, refusal: "field" })
    expect(readEdit({ value: "hi", node: "b" })).toEqual({ ok: false, refusal: "field" })
    expect(readEdit({ value: "hi" })).toEqual({ ok: false, refusal: "field" })
    expect(readEdit({ value: "hi", node: "258." })).toEqual({ ok: false, refusal: "field" })
  })

  it("reads a node id and refuses anything else", () => {
    expect(readNode("258.7")).toBe("258.7")
    expect(readNode("n4k2j9x0q1zab.7")).toBe("n4k2j9x0q1zab.7")
    expect(readNode("n4k2j9x0q1zab.n4k2j9x0q1zab")).toBe("n4k2j9x0q1zab.n4k2j9x0q1zab")
    expect(readNode("0.0000000000")).toBe("0.0000000000")
    expect(readNode("a")).toBeUndefined()
    expect(readNode("258.")).toBeUndefined()
    expect(readNode("12345678901.7")).toBeUndefined()
    expect(readNode("258.12345678901")).toBeUndefined()
    expect(readNode(7)).toBeUndefined()
    expect(readNode(undefined)).toBeUndefined()
  })

  it("keeps a named node", () => {
    expect(readEdit({ value: "hi", node: "258.7" })).toEqual({ ok: true, edit: { value: "hi", node: "258.7" } })
    expect(readEdit({ value: "hi", node: "258.n4k2j9x0q1zab", floor: "old" })).toEqual({
      ok: true,
      edit: { value: "hi", node: "258.n4k2j9x0q1zab", floor: "old" },
    })
  })

  it("refuses a readAt on a person edit", () => {
    expect(readEdit({ value: "hi", node: "258.7", readAt: 0 })).toEqual({ ok: false, refusal: "field" })
    expect(readCommit({ deck: "deck", batch: [{ value: "hi", node: "258.7", readAt: 0 }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses malformed element ids on person and agent edits", () => {
    for (const node of [".7", "12345678901.7", "258.12345678901", "258.n123456789ab", "258.nA23456789abc", "258.7\n"]) {
      expect(readEdit({ value: "x", node })).toEqual({ ok: false, refusal: "field" })
      expect(readAgentEdit({ deck: "deck", base: 0, changes: [{ value: "x", node, readAt: 0 }] })).toEqual({
        ok: false,
        refusal: "field",
      })
    }
  })

  it("refuses a floor that is not a string", () => {
    expect(readEdit({ value: "x", node: "258.7", floor: 7 })).toEqual({ ok: false, refusal: "field" })
    expect(
      readAgentEdit({ deck: "deck", base: 0, changes: [{ value: "x", node: "258.7", readAt: 0, floor: 7 }] }),
    ).toEqual({ ok: false, refusal: "field" })
  })
})

describe("readCommit", () => {
  it("reads a batch of edits", () => {
    expect(
      readCommit({
        deck: "deck",
        batch: [
          { value: "hi", node: "258.7" },
          { value: "ho", node: "258.8", floor: "ho" },
        ],
      }),
    ).toEqual({
      ok: true,
      deck: "deck",
      batch: [
        { value: "hi", node: "258.7" },
        { value: "ho", node: "258.8", floor: "ho" },
      ],
    })
  })

  it("keeps an element id read from a file", () => {
    expect(readCommit({ deck: "deck", batch: [{ value: "kept", node: "382.5", floor: "file text" }] })).toEqual({
      ok: true,
      deck: "deck",
      batch: [{ value: "kept", node: "382.5", floor: "file text" }],
    })
  })

  it("refuses an actor beside the batch", () => {
    expect(readCommit({ deck: "deck", actor: "agent", batch: [{ value: "hi", node: "258.7" }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses an empty batch", () => {
    expect(readCommit({ deck: "deck", batch: [] })).toEqual({ ok: false, refusal: "batch" })
  })

  it("reads a batch of 100", () => {
    const batch = Array.from({ length: 100 }, () => ({ value: "hi", node: "258.7" }))
    expect(readCommit({ deck: "deck", batch })).toEqual({ ok: true, deck: "deck", batch })
  })

  it("refuses a batch longer than 100", () => {
    expect(
      readCommit({ deck: "deck", batch: Array.from({ length: 101 }, () => ({ value: "hi", node: "258.7" })) }),
    ).toEqual({
      ok: false,
      refusal: "batch",
    })
  })

  it("refuses a once that is not 1 to 64 safe characters", () => {
    const batch = [{ value: "hi", node: "258.7" }]
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
    expect(readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", node: "258.7", readAt: 0 }] })).toEqual({
      ok: true,
      deck: "deck",
      base: 4,
      changes: [{ value: "hi", node: "258.7", readAt: 0 }],
    })
    expect(
      readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", node: "258.7", readAt: 0, floor: "kept" }] }),
    ).toEqual({
      ok: true,
      deck: "deck",
      base: 4,
      changes: [{ value: "hi", node: "258.7", readAt: 0, floor: "kept" }],
    })
  })

  it("refuses an actor inside a change", () => {
    expect(
      readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", node: "258.7", readAt: 0, actor: "agent" }] }),
    ).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses an agent change without a whole readAt", () => {
    expect(readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", node: "258.7" }] })).toEqual({
      ok: false,
      refusal: "field",
    })
    expect(readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", node: "258.7", readAt: 1.5 }] })).toEqual({
      ok: false,
      refusal: "field",
    })
    expect(readAgentEdit({ deck: "deck", base: 4, changes: [{ value: "hi", node: "258.7", readAt: -1 }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses an agent change without a node", () => {
    expect(readAgentEdit({ deck: "deck", base: 0, changes: [{ value: "x", readAt: 0 }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses a string readAt", () => {
    expect(readAgentEdit({ deck: "deck", base: 0, changes: [{ value: "x", node: "258.7", readAt: "0" }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses an unknown key on an agent change", () => {
    expect(
      readAgentEdit({ deck: "deck", base: 0, changes: [{ value: "x", node: "258.7", readAt: 0, extra: true }] }),
    ).toEqual({ ok: false, refusal: "field" })
  })

  it("requires a whole number base on an agent edit", () => {
    expect(readAgentEdit({ deck: "deck", changes: [{ value: "x", node: "258.7", readAt: 0 }] })).toEqual({
      ok: false,
      refusal: "base",
    })
    expect(readAgentEdit({ deck: "deck", base: "0", changes: [{ value: "x", node: "258.7", readAt: 0 }] })).toEqual({
      ok: false,
      refusal: "base",
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

describe("readRunStart", () => {
  const elements = [{ node: "258.7" }]

  it("reads a run and its elements", () => {
    expect(
      readRunStart({ deck: "deck", runId: "run", elements: [{ node: "258.7" }, { node: "258.8", floor: "" }] }),
    ).toEqual({ ok: true, deck: "deck", runId: "run", elements: [{ node: "258.7" }, { node: "258.8", floor: "" }] })
  })

  it("refuses anything that is not an object", () => {
    for (const raw of [null, 7, "run", [], undefined]) {
      expect(readRunStart(raw)).toEqual({ ok: false, refusal: "field" })
    }
  })

  it("refuses an actor beside the elements", () => {
    expect(readRunStart({ deck: "deck", runId: "run", elements, actor: "person" })).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("refuses a missing deck as a field", () => {
    expect(readRunStart({ runId: "run", elements })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a malformed deck", () => {
    expect(readRunStart({ deck: "bad deck", runId: "run", elements })).toEqual({ ok: false, refusal: "deck" })
  })

  it("refuses a run id that is not 1 to 64 safe characters", () => {
    for (const runId of [undefined, 7, "", "a".repeat(65), "bad run"]) {
      expect(readRunStart({ deck: "deck", runId, elements })).toEqual({ ok: false, refusal: "field" })
    }
    const fit = "a".repeat(64)
    expect(readRunStart({ deck: "deck", runId: fit, elements })).toEqual({
      ok: true,
      deck: "deck",
      runId: fit,
      elements,
    })
  })

  it("refuses a missing run id", () => {
    expect(readRunStart({ deck: "deck", elements })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses missing, empty or non-list elements as a batch", () => {
    expect(readRunStart({ deck: "deck", runId: "run" })).toEqual({ ok: false, refusal: "batch" })
    expect(readRunStart({ deck: "deck", runId: "run", elements: [] })).toEqual({ ok: false, refusal: "batch" })
    expect(readRunStart({ deck: "deck", runId: "run", elements: { node: "258.7" } })).toEqual({
      ok: false,
      refusal: "batch",
    })
  })

  it("reads 100 elements and refuses 101", () => {
    const fit = Array.from({ length: 100 }, () => ({ node: "258.7" }))
    expect(readRunStart({ deck: "deck", runId: "run", elements: fit })).toEqual({
      ok: true,
      deck: "deck",
      runId: "run",
      elements: fit,
    })
    expect(readRunStart({ deck: "deck", runId: "run", elements: [...fit, { node: "258.7" }] })).toEqual({
      ok: false,
      refusal: "batch",
    })
  })

  it("refuses an element that is not an object", () => {
    expect(readRunStart({ deck: "deck", runId: "run", elements: ["258.7"] })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a value or an actor on an element", () => {
    for (const element of [
      { node: "258.7", value: "hi" },
      { node: "258.7", actor: "person" },
    ]) {
      expect(readRunStart({ deck: "deck", runId: "run", elements: [element] })).toEqual({
        ok: false,
        refusal: "field",
      })
    }
  })

  it("refuses a malformed element id", () => {
    for (const node of ["a", "b", "258.", 7, undefined]) {
      expect(readRunStart({ deck: "deck", runId: "run", elements: [{ node }] })).toEqual({
        ok: false,
        refusal: "field",
      })
    }
  })

  it("refuses a floor that is not a string", () => {
    expect(readRunStart({ deck: "deck", runId: "run", elements: [{ node: "258.7", floor: 7 }] })).toEqual({
      ok: false,
      refusal: "field",
    })
  })
})

describe("readRun", () => {
  it("reads a deck and a run id", () => {
    expect(readRun({ deck: "deck", runId: "run" })).toEqual({ ok: true, deck: "deck", runId: "run" })
  })

  it("refuses anything that is not an object", () => {
    for (const raw of [null, 7, "run", [], undefined]) {
      expect(readRun(raw)).toEqual({ ok: false, refusal: "field" })
    }
  })

  it("refuses an actor or elements beside the run", () => {
    expect(readRun({ deck: "deck", runId: "run", actor: "person" })).toEqual({ ok: false, refusal: "field" })
    expect(readRun({ deck: "deck", runId: "run", elements: [] })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a missing deck as a field", () => {
    expect(readRun({ runId: "run" })).toEqual({ ok: false, refusal: "field" })
  })

  it("refuses a malformed deck", () => {
    expect(readRun({ deck: "bad deck", runId: "run" })).toEqual({ ok: false, refusal: "deck" })
  })

  it("refuses a run id that is missing or not 1 to 64 safe characters", () => {
    expect(readRun({ deck: "deck" })).toEqual({ ok: false, refusal: "field" })
    for (const runId of [7, "", "a".repeat(65), "bad run"]) {
      expect(readRun({ deck: "deck", runId })).toEqual({ ok: false, refusal: "field" })
    }
  })
})

describe("run operations in the catalog", () => {
  it("lists them as commands an agent cannot call until its server answers them", () => {
    for (const op of [catalog.start_run, catalog.stop_run, catalog.undo_run]) {
      expect(op).toEqual({ kind: "command", exposure: "web" })
    }
    expect(projectTools(catalog).map((tool) => tool.op)).toEqual(["capture_slide", "edit_deck"])
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
