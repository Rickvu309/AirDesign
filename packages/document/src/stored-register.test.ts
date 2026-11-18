import { describe, expect, it } from "vitest"
import {
  currentValue,
  decide,
  history,
  openRegister,
  version,
  type Command,
  type NodeRegister,
  type Register,
} from "./decide.js"
import { elementId, legacyElement, rootElement, type ElementId } from "./element-id.js"
import { format } from "./format.js"
import { readRegister } from "./stored.js"

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") {
    throw new Error(`${command.command} refused ${decision.code}`)
  }
  return decision.register
}

function bodyOf(register: Register, id: ElementId): NodeRegister {
  const body = register.elements[id]
  if (body === undefined) {
    throw new Error("missing node")
  }
  return body
}

function read(raw: unknown, index?: unknown): Register {
  const stored = readRegister(JSON.parse(JSON.stringify(raw)), index)
  if (!stored.ok) throw new Error(stored.refusal)
  return stored.value
}

const pairedBody: NodeRegister = {
  ...bodyOf(openRegister("paired", "slide"), rootElement),
  landed: [{ actor: "agent", value: "pair", visible: true, runId: "s" }],
  version: 1,
  phase: "stopped",
  runId: "s",
  readAt: 0,
  claimed: 0,
  stoppedAt: 1,
}

function rootShaped() {
  const opened = openRegister("floor", "slide")
  return {
    route: "slide",
    floor: "floor",
    landed: [
      { actor: "person", value: "typed", visible: true },
      { actor: "agent", value: "hidden", visible: false, runId: "r" },
    ],
    phase: "undone",
    runId: "r",
    readAt: 1,
    guarded: false,
    claimed: 1,
    stoppedAt: 2,
    slides: 3,
    bytes: 40,
    nodes: [rootElement, legacyElement, elementId("258.7")],
    readNodes: [rootElement],
    elements: { [elementId("258.7")]: bodyOf(applied(opened, { command: "person", value: "map" }), rootElement) },
    b: pairedBody,
  }
}

function holding(row: object) {
  const register = openRegister("", "")
  const node = elementId("258.7")
  return {
    ...register,
    nodes: [...register.nodes, node],
    elements: {
      ...register.elements,
      [node]: { ...bodyOf(register, rootElement), landed: [{ actor: "agent", visible: true, runId: "r", ...row }] },
    },
  }
}

describe("a register stored in the root shape reads as today's element map", () => {
  it("folds a register stored in the root shape with a run, an undo and a hidden row", () => {
    const stored = rootShaped()
    const folded = read(stored)
    expect(Object.keys(folded).sort()).toEqual([
      "bytes",
      "elements",
      "file",
      "floor",
      "nodes",
      "order",
      "readNodes",
      "route",
      "slides",
    ])
    expect(folded).toMatchObject({ route: "slide", floor: "floor", slides: 3, bytes: 40 })
    expect(folded.nodes).toEqual([rootElement, legacyElement, "258.7"])
    expect(folded.readNodes).toEqual([rootElement])
    const first = bodyOf(folded, rootElement)
    expect(first.landed).toEqual(stored.landed)
    expect(version(first)).toBe(3)
    expect(first.phase).toBe("undone")
    expect(history(first)).toEqual(["typed"])
    expect(bodyOf(folded, legacyElement)).toEqual(pairedBody)
    expect(currentValue(bodyOf(folded, elementId("258.7")))).toBe("map")
    expect(read(folded)).toEqual(folded)
  })

  it("answers an undo of the legacy node's run and keeps the first element", () => {
    const folded = read(rootShaped())
    const undone = applied(folded, { command: "undo", runId: "s", node: legacyElement })
    expect(bodyOf(undone, legacyElement).phase).toBe("undone")
    expect(history(bodyOf(undone, legacyElement))).toEqual([])
    expect(bodyOf(undone, rootElement)).toEqual(bodyOf(folded, rootElement))
  })

  it("keeps a stored map body over the legacy field and the root over a map entry for the first element", () => {
    const stored = rootShaped()
    const own = { ...pairedBody, floor: "own" }
    const folded = read({
      ...stored,
      elements: { ...stored.elements, [legacyElement]: own, [rootElement]: pairedBody },
    })
    expect(bodyOf(folded, legacyElement)).toEqual(own)
    expect(bodyOf(folded, rootElement).landed).toEqual(stored.landed)
    expect(Object.hasOwn(read({ ...stored, b: null }).elements, legacyElement)).toBe(false)
  })

  it("opens the slide order of a register stored before it had one", () => {
    const { file: _file, order: _order, ...stored } = openRegister("floor", "slide")
    expect(read(stored)).toEqual(openRegister("floor", "slide"))
  })
})

describe("readRegister", () => {
  it("reads a register with no format as this build's", () => {
    const register = openRegister("", "")
    expect(readRegister(JSON.parse(JSON.stringify(register)))).toEqual({ ok: true, value: register })
  })

  it("reads a newer format as newer before it checks a node", () => {
    expect(readRegister({ format: format + 1 })).toEqual({ ok: false, refusal: "newer" })
    expect(readRegister({ format: format + 1, elements: { "258.slide": { route: 1 } } })).toEqual({
      ok: false,
      refusal: "newer",
    })
  })

  it("reads a register at this build's format that does not parse as payload", () => {
    expect(readRegister({ format, elements: { "258.slide": {} } })).toEqual({ ok: false, refusal: "payload" })
  })

  it("reads each stored row through readRow, a row of trait fields included", () => {
    const written = holding({ v: format, patch: { box: { x: { set: 12_700 } }, text: { value: { set: "Hi" } } } })
    expect(readRegister(JSON.parse(JSON.stringify(written)))).toEqual({ ok: true, value: written })
    expect(readRegister(holding({ v: format, patch: { box: { spin: { set: 1 } } } }))).toEqual({
      ok: false,
      refusal: "payload",
    })
    expect(readRegister(holding({ v: format + 1, patch: { glow: { radius: { set: 1 } } } }))).toEqual({
      ok: false,
      refusal: "newer",
    })
  })

  it("keeps a format 1 row in its stored form and hands back the value it read, not the raw one", () => {
    const node = elementId("258.7")
    const box = readRegister(holding({ property: "box", value: { x: -0, y: 2, cx: 3, cy: 4 } }))
    const boxRow = box.ok ? box.value.elements[node]?.landed[0] : undefined
    expect(boxRow).toEqual({
      actor: "agent",
      visible: true,
      runId: "r",
      property: "box",
      value: { x: 0, y: 2, cx: 3, cy: 4 },
    })
    expect(boxRow?.property === "box" && Object.is(boxRow.value.x, 0)).toBe(true)
    const text = readRegister(holding({ value: "Hi" }))
    expect(text.ok && text.value.elements[node]?.landed[0]).toEqual({
      actor: "agent",
      visible: true,
      runId: "r",
      value: "Hi",
    })
  })

  it("refuses a newer row in the root shape or the legacy node as newer, not as payload", () => {
    const stored = rootShaped()
    expect(readRegister({ ...stored, landed: [{ actor: "person", visible: true, v: format + 1, patch: {} }] })).toEqual(
      {
        ok: false,
        refusal: "newer",
      },
    )
    expect(
      readRegister({ ...stored, b: { ...pairedBody, landed: [{ actor: "agent", visible: true, v: format + 1 }] } }),
    ).toEqual({ ok: false, refusal: "newer" })
  })

  it("keeps the stored index as the same value and refuses a newer index or a newer index being built", () => {
    const register = openRegister("", "")
    const index = { format, total: 0, slides: [], elements: [], pages: [], next: { format, total: 1 } }
    const stored = readRegister(register, index)
    expect(stored.ok && stored.value.index).toBe(index)
    expect(readRegister(register, { ...index, format: format + 1 })).toEqual({ ok: false, refusal: "newer" })
    expect(readRegister(register, { ...index, next: { format: format + 1 } })).toEqual({ ok: false, refusal: "newer" })
    expect(readRegister({ ...register, index: { ...index, format: format + 1 } })).toEqual({
      ok: false,
      refusal: "newer",
    })
    expect(readRegister(register, "index")).toEqual({ ok: false, refusal: "payload" })
  })

  it("refuses a slide command from a newer build as newer", () => {
    const register = openRegister("", "")
    expect(readRegister({ ...register, order: [{ slide: "future-grid", id: "256" }] })).toEqual({
      ok: false,
      refusal: "newer",
    })
  })
})
