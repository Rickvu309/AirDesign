import fc from "fast-check"
import { expect, it } from "vitest"
import { currentValue, decide, history, openRegister, type Register } from "./decide.js"
import { appendIndex, type IndexElement } from "./deck-index.js"
import { elementId, shapeOf, slideId, storedElements, type ElementId, type SlideId } from "./element-id.js"
import { floorFor, openingElement } from "./slide-floor.js"
import { nextSlideId, orderKeyAfter, presentSlides, type SlideCommand } from "./slide-order.js"

const file = [slideId("256"), slideId("257")]
const opening: IndexElement[] = [
  { node: elementId("256.2"), kind: "shape", value: "a", box: null, grouped: false },
  { node: elementId("256.3"), kind: "shape", value: "b", box: null, grouped: false },
  { node: elementId("257.2"), kind: "shape", value: "c", box: null, grouped: false },
]
const placeholder = (slide: SlideId): IndexElement => ({
  node: elementId(`${slide}.2`),
  kind: "shape",
  value: null,
  box: null,
  grouped: false,
})

type Step =
  | { readonly step: "edit"; readonly pick: number; readonly value: string }
  | { readonly step: "clone" | "add" | "remove"; readonly pick: number }

const step: fc.Arbitrary<Step> = fc.oneof(
  fc.record({ step: fc.constant("edit" as const), pick: fc.nat(), value: fc.string({ maxLength: 4 }) }),
  fc.record({ step: fc.constantFrom("clone" as const, "add" as const, "remove" as const), pick: fc.nat() }),
)

function indexed(): Register {
  const index = appendIndex(undefined, {
    once: "opening",
    offset: 0,
    total: opening.length,
    slides: file.map((id, position) => ({ id, position })),
    elements: opening,
  })
  if (!index.ok) throw new Error(index.refusal)
  return { ...openRegister("", ""), index: index.index }
}

function applied(register: Register, command: Parameters<typeof decide>[1]): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function shown(register: Register, node: ElementId): string | null {
  const body = register.elements[node]
  if (body !== undefined && history(body).length > 0) return currentValue(body)
  return openingElement(register, node)?.value ?? null
}

function personEdit(register: Register, node: ElementId, value: string): Register {
  const open = register.nodes.includes(node)
    ? register
    : applied(register, { command: "add", node, floor: "", route: "" })
  return applied(open, { command: "person", value, node })
}

function onDevice(server: Register): Register {
  let device: Register = { ...openRegister("", ""), ...(server.index === undefined ? {} : { index: server.index }) }
  for (const node of storedElements(server)) {
    const body = server.elements[node]
    if (body === undefined || !node.includes(".")) continue
    for (const row of body.landed) {
      if (!row.visible || row.v !== undefined || row.property === "box") continue
      device = personEdit(device, node, row.value)
    }
  }
  for (const edit of server.order) device = applied(device, { command: "slide", file, edit })
  return device
}

it("opens every clone as its source was when the clone landed, in server order and in the device's replay order", () => {
  fc.assert(
    fc.property(fc.array(step, { maxLength: 24 }), (steps) => {
      let server = indexed()
      const model = new Map<ElementId, string | null>(opening.map((element) => [element.node, element.value]))
      for (const next of steps) {
        const present = presentSlides(server)
        const target = present[next.pick % present.length]
        if (target === undefined) continue
        const nodes = [...model.keys()].filter((node) => present.some((spot) => spot.id === shapeOf(node).slide))
        if (next.step === "edit") {
          const node = nodes[next.pick % nodes.length]
          if (node === undefined) continue
          server = personEdit(server, node, next.value)
          model.set(node, next.value)
          continue
        }
        if (next.step === "remove") {
          if (present.length < 2) continue
          server = applied(server, { command: "slide", file, edit: { slide: "remove", id: target.id } })
          continue
        }
        const key = orderKeyAfter(present, target.id)
        if (key === null || present.length >= 50) continue
        const id = nextSlideId([...file, ...server.order.flatMap((command) => ("id" in command ? [command.id] : []))])
        const source = nodes
          .filter((node) => shapeOf(node).slide === target.id)
          .map((node) => ({
            ...(openingElement(server, node) ?? placeholder(target.id)),
            node,
            value: model.get(node) ?? null,
          }))
        const floor = next.step === "clone" ? floorFor(source, id) : [placeholder(id)]
        const edit: SlideCommand =
          next.step === "clone"
            ? { slide: "clone", id, source: target.id, key, floor }
            : { slide: "add", id, after: target.id, key, layout: target.id, floor }
        server = applied(server, { command: "slide", file, edit })
        for (const row of floor) model.set(row.node, row.value)
      }
      const device = onDevice(server)
      for (const [node, value] of model) {
        expect(shown(server, node)).toBe(value)
        expect(shown(device, node)).toBe(value)
      }
      const named = [
        ...(server.index?.elements ?? []),
        ...server.order.flatMap((command) => ("floor" in command ? (command.floor ?? []) : [])),
      ].map((element) => element.node)
      expect(new Set(named).size).toBe(named.length)
    }),
    { numRuns: 300 },
  )
})
