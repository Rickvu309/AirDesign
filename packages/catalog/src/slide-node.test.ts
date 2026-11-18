import {
  decide,
  elementId,
  openRegister,
  readElementId,
  readIndexPage,
  readRegister,
  rootElement,
  storedElements,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { deckRoutes } from "./index.js"

const node = () => ({
  route: "slide",
  floor: "",
  landed: [
    { actor: "person", visible: true, v: 2, patch: { fill: { value: { set: { solid: { scheme: "accent2" } } } } } },
  ],
  phase: "idle",
  runId: null,
  readAt: null,
  guarded: false,
  claimed: null,
  stoppedAt: null,
  slides: 0,
  bytes: 1,
})

it("reads a slide's own node, 258.slide, wherever a node id is read", () => {
  expect(readElementId("258.slide")).toBe("258.slide")
  expect(readElementId("258.slides")).toBeUndefined()
  const deck = { route: "slide", floor: "", slides: 0, bytes: 1, nodes: ["258.slide"], readNodes: null }
  expect(readRegister({ ...deck, elements: { "258.slide": node() } }).ok).toBe(true)
  const element = { node: "256.slide", kind: "slide", value: null, box: null, grouped: false }
  const shape = { node: "256.7", kind: "shape", value: null, box: null, grouped: false }
  const page = { once: "once", offset: 0, total: 2, slides: [{ id: "256", position: 0 }], elements: [shape, element] }
  expect(readIndexPage(page)).not.toBeNull()
  expect(storedElements({ elements: { "256.slide": 1, "256.notes": 2, "256.7": 3 } })).toEqual([
    "256.slide",
    "256.notes",
    "256.7",
  ])
  const register = openRegister("", "deck")
  const answer = {
    ok: true,
    deck: "deck",
    revision: 0,
    register: {
      ...register,
      nodes: [rootElement, "256.slide"],
      elements: { ...register.elements, "256.slide": node() },
    },
  }
  expect(deckRoutes.open.result(answer)).toMatchObject({ ok: true })
})

it("lands a fill on a slide's own node and refuses text there, while notes still take text", () => {
  const added = decide(openRegister("", "deck"), {
    command: "add",
    node: elementId("258.slide"),
    floor: "",
    route: "slide",
  })
  if (added.decision !== "apply") throw new Error("add")
  expect(decide(added.register, { command: "person", node: elementId("258.slide"), value: "words" })).toEqual({
    decision: "refuse",
    code: "kind",
  })
  const notes = decide(added.register, { command: "add", node: elementId("258.notes"), floor: "", route: "slide" })
  if (notes.decision !== "apply") throw new Error("add notes")
  expect(
    decide(notes.register, { command: "person", node: elementId("258.notes"), value: "Speaker notes" }).decision,
  ).toBe("apply")
})
