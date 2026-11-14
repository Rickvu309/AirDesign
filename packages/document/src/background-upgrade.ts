import type { IndexElement } from "./deck-index.js"
import { decide, landedPatch, type Landed, type NodeRegister, type Register } from "./decide.js"
import { slideNode, type ElementId, type SlideId } from "./element-id.js"
import { format } from "./format.js"
import { shows, type FieldEdit } from "./row.js"
import { floorOpening } from "./slide-floor.js"
import type { SlideClone, SlideCommand } from "./slide-order.js"
import type { FieldValue } from "./traits.js"

type Fill = FieldValue<"fill", "value">

type Shown = FieldEdit<Fill>

type Stored = Extract<SlideCommand, { readonly slide: "background" }>

function shownOf(command: Stored): Shown {
  return command.color === null ? "opening" : { set: { solid: command.color } }
}

function landedOf(command: Stored): Landed {
  const patch = { fill: { value: shownOf(command) } }
  if (command.runId === undefined) return { actor: "person", visible: true, v: format, patch }
  return { actor: "agent", visible: true, runId: command.runId, v: format, patch }
}

function ownsNode(command: SlideClone): boolean {
  const node = slideNode(command.id, "slide")
  return command.floor?.some((element) => element.node === node) === true
}

function slideFloor(slide: SlideId, value: Fill): IndexElement {
  const node = slideNode(slide, "slide")
  return { node, kind: "slide", value: null, box: null, grouped: false, opening: { fill: { value: { set: value } } } }
}

function bodyOf(register: Register, node: ElementId, rows: readonly Landed[]): NodeRegister {
  const kept = register.elements[node]
  if (kept !== undefined) return { ...kept, landed: [...rows, ...kept.landed] }
  return {
    route: register.route,
    floor: "",
    landed: rows,
    phase: "idle",
    runId: null,
    readAt: null,
    guarded: false,
    claimed: null,
    stoppedAt: null,
    slides: 1,
    bytes: 0,
  }
}

export function upgradeBackgrounds(register: Register): Register {
  if (!register.order.some((command) => command.slide === "background")) return register
  const shown = new Map<SlideId, Shown>()
  const opened = new Map<SlideId, Fill>()
  const rows = new Map<ElementId, Landed[]>()
  const order: SlideCommand[] = []
  const copied = (source: SlideId): Fill | undefined => {
    const held = shown.get(source)
    return typeof held === "object" ? held.set : opened.get(source)
  }
  for (const command of register.order) {
    if (command.slide === "background") {
      const node = slideNode(command.id, "slide")
      shown.set(command.id, shownOf(command))
      rows.set(node, [...(rows.get(node) ?? []), landedOf(command)])
      continue
    }
    const value = command.slide === "clone" && !ownsNode(command) ? copied(command.source) : undefined
    if (command.slide !== "clone" || value === undefined) {
      order.push(command)
      continue
    }
    opened.set(command.id, value)
    order.push({ ...command, floor: [...(command.floor ?? []), slideFloor(command.id, value)] })
  }
  const elements = { ...register.elements }
  for (const [node, landed] of rows) elements[node] = bodyOf(register, node, landed)
  const added = [...rows.keys()].filter((node) => !register.nodes.includes(node))
  return { ...register, order, nodes: [...register.nodes, ...added], elements }
}

export function ownFloor(register: Register, slide: SlideId): IndexElement {
  const view = upgradeBackgrounds(register)
  const node = slideNode(slide, "slide")
  const body = view.nodes.includes(node) ? view.elements[node] : undefined
  const opening = floorOpening(view, node, body === undefined ? {} : landedPatch(body, "text"))
  return { node, kind: "slide", value: null, box: null, grouped: false, ...(opening === undefined ? {} : { opening }) }
}

function storedBefore(order: readonly SlideCommand[], slide: SlideId): Shown {
  let held: Shown = "opening"
  for (const command of order) if (command.slide === "background" && command.id === slide) held = shownOf(command)
  return held
}

export function backgroundUndone(
  register: Register,
  before: readonly SlideCommand[],
  command: Stored,
): Register | null {
  const node = slideNode(command.id, "slide")
  const body = upgradeBackgrounds(register).elements[node]
  if (body === undefined || !shows(landedPatch(body, "text"), { fill: { value: shownOf(command) } })) return null
  let current = register
  if (!current.nodes.includes(node)) {
    const added = decide(current, { command: "add", node, floor: "", route: current.route })
    if (added.decision === "refuse") return null
    current = added.register
  }
  const patch = { fill: { value: storedBefore(before, command.id) } }
  const turned = decide(current, { command: "person", node, v: format, patch })
  return turned.decision === "apply" ? turned.register : null
}
