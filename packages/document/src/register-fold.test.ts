import { describe, expect, it } from "vitest"
import {
  currentValue,
  decide,
  foldRegister,
  history,
  openRegister,
  version,
  type Command,
  type NodeRegister,
  type Register,
  type RootRegister,
} from "./decide.js"
import { elementId, legacyElement, rootElement, type ElementId } from "./element-id.js"

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

function rootShaped(): RootRegister {
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

describe("foldRegister", () => {
  it("folds a register stored in the root shape with a run, an undo and a hidden row", () => {
    const stored = rootShaped()
    const folded = foldRegister(stored)
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
    expect(foldRegister(folded)).toBe(folded)
  })

  it("answers every command on a root-shaped register as it answers the folded one", () => {
    const stored = rootShaped()
    const folded = foldRegister(stored)
    const commands: readonly Command[] = [
      { command: "person", value: "next" },
      { command: "start", runId: "t" },
      { command: "undo", runId: "r" },
      { command: "undo", runId: "s", node: legacyElement },
      { command: "start", runId: "u", node: legacyElement },
      { command: "read", runId: "s", node: legacyElement },
      { command: "remove", node: legacyElement },
      { command: "person", value: "map", node: elementId("258.7") },
      { command: "add", node: elementId("258.9"), floor: "x", route: "y" },
    ]
    for (const command of commands) {
      expect(decide(stored, command), command.command).toEqual(decide(folded, command))
    }
    const undone = applied(folded, { command: "undo", runId: "s", node: legacyElement })
    expect(bodyOf(undone, legacyElement).phase).toBe("undone")
    expect(history(bodyOf(undone, legacyElement))).toEqual([])
    expect(bodyOf(undone, rootElement)).toEqual(bodyOf(folded, rootElement))
  })

  it("keeps a stored map body over the legacy field and the root over a map entry for the first element", () => {
    const stored = rootShaped()
    const own = { ...pairedBody, floor: "own" }
    const folded = foldRegister({
      ...stored,
      elements: { ...stored.elements, [legacyElement]: own, [rootElement]: pairedBody },
    })
    expect(bodyOf(folded, legacyElement)).toEqual(own)
    expect(bodyOf(folded, rootElement).landed).toEqual(stored.landed)
    expect(Object.hasOwn(foldRegister({ ...stored, b: null }).elements, legacyElement)).toBe(false)
  })

  it("does not take a deck register where an element is expected", () => {
    const fits: Register extends NodeRegister ? true : false = false
    expect(fits).toBe(false)
  })
})

describe("every element", () => {
  it("walks every element of a deck, the first one included, through the same code path", () => {
    let register = openRegister("floor", "slide")
    for (const id of [elementId("258.7"), elementId("258.n4k2j9x0q1zab")]) {
      register = applied(register, { command: "add", node: id, floor: "floor", route: "slide" })
    }
    expect(register.nodes).toHaveLength(3)
    expect(Object.keys(register.elements).sort()).toEqual([...register.nodes].sort())
    for (const node of register.nodes) {
      const runId = `run-${node}`
      register = applied(register, { command: "person", value: "typed", node })
      register = applied(register, { command: "start", runId, node })
      const readAt = version(bodyOf(register, node))
      register = applied(register, { command: "agent", runId, readAt, value: "wrote", node })
      register = applied(register, { command: "stop", runId, node })
      expect(history(bodyOf(register, node)), node).toEqual(["typed", "wrote"])
      register = applied(register, { command: "undo", runId, node })
      const body = bodyOf(register, node)
      expect(body.phase, node).toBe("undone")
      expect(history(body), node).toEqual(["typed"])
      expect(version(body), node).toBe(3)
    }
    for (const node of register.nodes) {
      expect(currentValue(bodyOf(register, node)), node).toBe("typed")
    }
  })
})
