import { describe, expect, it } from "vitest"
import {
  decide,
  elementId,
  kinds,
  kindTraits,
  removable,
  takes,
  openRegister,
  slideId,
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
  ["256.4", "shape", null, false],
  ["256.5", "connector", null, false],
  ["256.6", "group", null, false],
  ["256.7", "shape", '[{"from":0,"runs":[{"from":0,"text":"Inside"}]}]', true],
  ["256.10", "kept", null, false],
  ["256.11", "shape", null, false],
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
      ["256.10", "kind"],
      ["256.11", "kind"],
      ["256.notes", "apply"],
    ])
  })

  it("admits a move and a resize where the device writes one", () => {
    expect(rows.map(([node]) => [node, agentBox(node, moved), agentBox(node, grown)])).toEqual([
      ["256.2", "apply", "apply"],
      ["256.3", "apply", "apply"],
      ["256.4", "apply", "apply"],
      ["256.5", "apply", "apply"],
      ["256.6", "apply", "apply"],
      ["256.7", "apply", "apply"],
      ["256.10", "kind", "kind"],
      ["256.11", "apply", "apply"],
      ["256.notes", "kind", "kind"],
    ])
  })

  it("refuses a delete the person's own Delete refuses: a grouped element and an animated one, and deletes a group", () => {
    expect(rows.filter(([node]) => !node.endsWith(".notes")).map(([node]) => [node, removal(node)])).toEqual([
      ["256.2", "apply"],
      ["256.3", "apply"],
      ["256.4", "apply"],
      ["256.5", "apply"],
      ["256.6", "apply"],
      ["256.7", "group-box"],
      ["256.10", "apply"],
      ["256.11", "locked"],
    ])
  })

  it("names what each kind takes field by field, only from the traits the kind takes", () => {
    const facts = { text: true, grouped: false, animated: false }
    const box = ["box.x", "box.y", "box.w", "box.h", "box.rot", "box.flipH", "box.flipV"]
    const drawn = [...box, "geometry.shape"]
    const border = ["fill", "width", "dash", "cap", "compound", "join", "head", "tail", "alpha"].map(
      (field) => `border.${field}`,
    )
    const slots = ["fills.p0", "fills.p1", "fills.p2", "fills.p3"]
    const image = [
      "fills.source",
      "fills.weight",
      "fills.color",
      "fills.mode",
      "fills.tileScale",
      "fills.crop",
      "fills.recolor",
      "fills.blur",
    ]
    const fill = [...slots, ...image, "fills.alpha"]
    const body = ["insets", "anchor", "wrap", "autofit", "vertical", "columns"].map((field) => `body.${field}`)
    const text = [...body, "text.value", "text.alpha", "link.target"]
    const effects = [
      "effects.shadow",
      "effects.innerShadow",
      "effects.glow",
      "effects.softEdge",
      "effects.blur",
      "effects.drop1",
      "effects.drop2",
      "effects.drop3",
      "effects.inner1",
      "effects.inner2",
      "effects.inner3",
    ]
    const named = ["identity.name", "identity.alt", "identity.hidden", "identity.locked"]
    const masked = [...named, "identity.mask"]
    expect(takes({ ...facts, kind: "shape" })).toEqual([...masked, ...drawn, ...fill, ...border, ...effects, ...text])
    expect(takes({ ...facts, kind: "shape", text: false })).toEqual([
      ...masked,
      ...drawn,
      ...fill,
      ...border,
      ...effects,
    ])
    expect(takes({ ...facts, kind: "connector" })).toEqual([
      ...named,
      ...drawn,
      ...border,
      ...effects,
      "connection.start",
      "connection.end",
    ])
    expect(takes({ ...facts, kind: "group" })).toEqual([...named, ...box, ...effects])
    expect(takes({ ...facts, kind: "kept" })).toEqual([])
    expect(takes({ ...facts, kind: "slide" })).toEqual([
      ...slots,
      "fills.source",
      "templateStyle.id",
      "show.skipped",
      "transition.value",
      "guides.ruler",
      "guides.layout",
    ])
    expect(takes({ ...facts, kind: "notes" })).toEqual(["notes.value"])
    expect(takes({ ...facts, kind: "shape", grouped: true })).toEqual([
      ...masked,
      ...box,
      "geometry.shape",
      ...fill,
      ...border,
      ...effects,
      ...text,
    ])
    for (const kind of kinds) {
      const traits: readonly string[] = kindTraits[kind]
      for (const field of takes({ ...facts, kind })) expect(traits).toContain(field.split(".")[0])
    }
  })

  it("lets a person delete what the person's own Delete deletes", () => {
    const facts = { text: true, grouped: false, animated: false }
    const removes = kinds.filter((kind) => removable({ ...facts, kind }))
    expect(removes).toEqual(["shape", "connector", "group", "kept"])
    expect(removable({ ...facts, kind: "shape", grouped: true })).toBe(false)
    expect(removable({ ...facts, kind: "shape", text: false, animated: true })).toBe(false)
  })
})
