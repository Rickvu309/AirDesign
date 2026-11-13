import { describe, expect, it } from "vitest"
import {
  decide,
  elementId,
  elementTakes,
  openingTable,
  openRegister,
  slideId,
  writeTableValue,
  type Box,
  type Command,
  type IndexElement,
  type Kind,
  type Register,
} from "./index.js"

const box: Box = { x: 100, y: 200, cx: 300, cy: 400 }
const moved: Box = { ...box, x: 900 }
const grown: Box = { ...box, cx: 500 }
const file = [slideId("256")]

const rows: readonly (readonly [string, Kind, string | null, boolean])[] = [
  ["256.2", "shape", '[{"from":0,"runs":[{"from":0,"text":"Title"}]}]', false],
  ["256.3", "shape", null, false],
  ["256.4", "picture", null, false],
  ["256.5", "connector", null, false],
  ["256.6", "group", null, false],
  ["256.7", "shape", '[{"from":0,"runs":[{"from":0,"text":"Inside"}]}]', true],
  ["256.8", "table", null, false],
  ["256.9", "chart", null, false],
  ["256.10", "kept", null, false],
  ["256.11", "picture", null, false],
  ["256.notes", "slide", "Speak", false],
]

const elements: readonly IndexElement[] = rows.map(([node, kind, value, grouped]) => ({
  node: elementId(node),
  kind,
  value,
  box: node.endsWith(".notes") ? null : box,
  grouped,
}))

const indexed: Register = {
  ...openRegister("", ""),
  file,
  index: {
    total: elements.length,
    slides: [{ id: "256", position: 0, free: 12, animated: ["11"] }],
    elements,
    pages: [],
  },
}

function opened(node: string): Register {
  const added = decide(indexed, { command: "add", node: elementId(node), floor: "", route: "" })
  if (added.decision !== "apply") throw new Error(added.code)
  return added.register
}

function agentRun(node: string): Register {
  const started = decide(opened(node), { command: "start", runId: "run", node: elementId(node) })
  if (started.decision !== "apply") throw new Error(started.code)
  return started.register
}

function agentText(node: string) {
  const command: Command = { command: "agent", runId: "run", readAt: 0, value: "Agent", node: elementId(node) }
  const decision = decide(agentRun(node), command)
  return decision.decision === "apply" ? "apply" : decision.code
}

function agentBox(node: string, value: Box) {
  const command: Command = { command: "agent", runId: "run", readAt: 0, property: "box", value, node: elementId(node) }
  const decision = decide(agentRun(node), command)
  return decision.decision === "apply" ? "apply" : decision.code
}

function personEdit(node: string, value: string) {
  const decision = decide(opened(node), { command: "person", value, node: elementId(node) })
  return decision.decision === "apply" ? "apply" : decision.code
}

function removal(node: string) {
  const decision = decide(indexed, {
    command: "slide",
    file,
    edit: { slide: "element-remove", id: slideId("256"), node: elementId(node) },
  })
  return decision.decision === "apply" ? "apply" : decision.code
}

describe("the server admits only the edits the device can write onto an element of each kind", () => {
  it("admits agent text only on a shape that holds a text body, and on notes", () => {
    expect(rows.map(([node]) => [node, agentText(node)])).toEqual([
      ["256.2", "apply"],
      ["256.3", "kind"],
      ["256.4", "kind"],
      ["256.5", "kind"],
      ["256.6", "kind"],
      ["256.7", "apply"],
      ["256.8", "kind"],
      ["256.9", "kind"],
      ["256.10", "kind"],
      ["256.11", "kind"],
      ["256.notes", "apply"],
    ])
  })

  it("admits a move where the device writes one, and a resize except on a table", () => {
    expect(rows.map(([node]) => [node, agentBox(node, moved), agentBox(node, grown)])).toEqual([
      ["256.2", "apply", "apply"],
      ["256.3", "apply", "apply"],
      ["256.4", "apply", "apply"],
      ["256.5", "apply", "apply"],
      ["256.6", "apply", "apply"],
      ["256.7", "group-box", "group-box"],
      ["256.8", "apply", "kind"],
      ["256.9", "apply", "apply"],
      ["256.10", "kind", "kind"],
      ["256.11", "apply", "apply"],
      ["256.notes", "kind", "kind"],
    ])
  })

  it("admits a person's table value on a table and nowhere else", () => {
    const table = writeTableValue(openingTable(2, 2))
    expect(personEdit("256.8", table)).toBe("apply")
    expect(personEdit("256.4", table)).toBe("kind")
    expect(personEdit("256.2", "Typed")).toBe("apply")
  })

  it("refuses a delete the person's own Delete refuses: a group, a grouped element, an animated one", () => {
    expect(rows.filter(([node]) => !node.endsWith(".notes")).map(([node]) => [node, removal(node)])).toEqual([
      ["256.2", "apply"],
      ["256.3", "apply"],
      ["256.4", "apply"],
      ["256.5", "apply"],
      ["256.6", "group-box"],
      ["256.7", "group-box"],
      ["256.8", "apply"],
      ["256.9", "apply"],
      ["256.10", "apply"],
      ["256.11", "locked"],
    ])
  })

  it("names what each kind takes in one table", () => {
    const facts = { text: true, grouped: false, animated: false }
    expect(elementTakes({ ...facts, kind: "shape" })).toEqual(["text", "move", "resize", "remove"])
    expect(elementTakes({ ...facts, kind: "shape", text: false })).toEqual(["move", "resize", "remove"])
    expect(elementTakes({ ...facts, kind: "picture" })).toEqual(["move", "resize", "remove"])
    expect(elementTakes({ ...facts, kind: "table" })).toEqual(["table", "move", "remove"])
    expect(elementTakes({ ...facts, kind: "group" })).toEqual(["move", "resize"])
    expect(elementTakes({ ...facts, kind: "kept" })).toEqual(["remove"])
    expect(elementTakes({ ...facts, kind: "slide" })).toEqual(["text"])
    expect(elementTakes({ ...facts, kind: "shape", grouped: true })).toEqual(["text"])
    expect(elementTakes({ ...facts, kind: "picture", animated: true })).toEqual(["move", "resize"])
  })
})
