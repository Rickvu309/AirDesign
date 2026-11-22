import {
  beforeOf,
  changeLayout,
  format,
  landedPatch,
  elementId,
  groupOf,
  maskTurn,
  nextElementId,
  plainFrameTurn,
  readSlideId,
  shapeOf,
  slideUndoable,
  ungroupTurn,
  type Box,
  type Command,
  type NodeStep,
  type ElementId,
  type Register,
  type Undoable,
} from "@airdesign/document"
import { freeShapeId, readShapes, readSlides, shapeKind } from "@airdesign/pptx"
import { slideBase } from "@/exported-parts"
import { indexedRegister } from "@/indexed-register"
import { fileSlides } from "@/slide-edit"
import { storeCommand } from "@/command-store"

type Parts = ReadonlyMap<string, Uint8Array>

export type GroupChange =
  | { readonly change: "group"; readonly nodes: readonly ElementId[] }
  | { readonly change: "ungroup"; readonly node: ElementId }
  | { readonly change: "frame"; readonly nodes: readonly ElementId[] }
  | { readonly change: "plain-frame"; readonly nodes: readonly ElementId[] }
  | { readonly change: "mask"; readonly nodes: readonly ElementId[] }

function reflowRows(register: Register, nodes: readonly ElementId[]): readonly Command[] | null {
  const [frame] = nodes
  const changed = frame === undefined ? null : changeLayout(register, { reflow: frame })
  if (changed === null || !("rows" in changed)) return null
  return changed.rows.map((row): Command => ({ command: "person", v: format, patch: row.patch, node: row.node }))
}

function rowSteps(register: Register, commands: readonly Command[]): readonly NodeStep[] {
  return commands.flatMap((command): NodeStep[] => {
    if (command.command !== "person" || command.node === undefined || command.v === undefined) return []
    const body = register.elements[command.node]
    const before = beforeOf(body === undefined ? {} : landedPatch(body, "text"), command.patch)
    return [{ node: command.node, before, after: command.patch }]
  })
}

function backLayer(base: Parts, part: string, nodes: readonly ElementId[]): ElementId | null {
  const order = readShapes(base).filter((shape) => shape.part === part)
  const placed = nodes.map((node) => ({ node, at: order.findIndex((shape) => shape.shape === shapeOf(node).shape) }))
  if (placed.some((each) => each.at < 0)) return null
  const back = placed.toSorted((left, right) => left.at - right.at)[0]
  const shape = back === undefined ? undefined : order[back.at]
  return back === undefined || shape === undefined || shapeKind(shape) !== "shape" ? null : back.node
}

type Planned = { readonly commands: readonly Command[]; readonly undoable: Undoable | null }

export function groupCommands(parts: Parts, register: Register, change: GroupChange): readonly Command[] | null {
  return groupPlan(parts, register, change)?.commands ?? null
}

function groupPlan(parts: Parts, register: Register, change: GroupChange): Planned | null {
  const commands = groupTurn(parts, register, change)
  if (commands === null || "undoable" in commands) return commands
  const head = commands[0]
  if (head === undefined) return null
  const undoable =
    head.command === "slide" ? slideUndoable(register, head.file, head.edit) : { steps: rowSteps(register, commands) }
  return { commands, undoable }
}

function groupTurn(parts: Parts, register: Register, change: GroupChange): readonly Command[] | Planned | null {
  const base = slideBase(parts, register)
  const file = fileSlides(parts, register)
  const first = change.change === "ungroup" ? change.node : change.nodes[0]
  const slide = first === undefined ? undefined : readSlideId(shapeOf(first).slide)
  if (slide === undefined) return null
  if (change.change === "ungroup") return ungroupTurn(register, file, slide, change.node)
  const found = readSlides(base).find((each) => each.slide === slide)
  if (found === undefined) return null
  const reflowed = change.change === "frame" && change.nodes.length === 1 ? reflowRows(register, change.nodes) : null
  if (reflowed !== null) return reflowed
  const node = nextElementId(register, slide, freeShapeId(base, found.part))
  if (change.change === "mask") {
    const mask = backLayer(base, found.part, change.nodes)
    return mask === null ? null : maskTurn(register, file, slide, node, change.nodes, mask)
  }
  if (change.change === "group") {
    const command = groupOf(register, slide, node, change.nodes)
    return command === null ? null : [{ command: "slide", file, edit: command }]
  }
  const backdrop = elementId(`${slide}.${String(Number(shapeOf(node).shape) + 1)}`)
  if (change.change === "plain-frame") return plainFrameTurn(register, file, slide, node, backdrop, change.nodes)
  const framed = changeLayout(register, { wrap: change.nodes, slide, node, backdrop })
  if (framed === null || !("slide" in framed)) return null
  const rows = framed.rows.map((row): Command => ({ command: "person", v: format, patch: row.patch, node: row.node }))
  return [{ command: "slide", file, edit: framed.slide }, ...rows]
}

export function groupPlanned(
  parts: Parts,
  register: Register,
  change: GroupChange,
): (Planned & { readonly made: ElementId | null }) | null {
  const planned = groupPlan(parts, indexedRegister(parts, register), change)
  const head = planned?.commands[0]
  if (planned === null || head === undefined) return null
  const made = head.command === "slide" && head.edit.slide === "element-group" ? head.edit.element.node : null
  return { ...planned, made }
}

export async function commitPlace(
  deckId: string,
  parts: Parts,
  register: Register,
  node: ElementId,
  box: Box,
  paint: (undoable: Undoable | null) => void | Promise<void>,
): Promise<"moved" | "kept" | "refused" | "stored"> {
  const indexed = indexedRegister(parts, register)
  const file = fileSlides(parts, register)
  const changed = changeLayout(indexed, { place: node, box, file })
  if (changed === null || !("turn" in changed)) return "moved"
  const head = changed.turn[0]
  if (head?.command !== "slide") return "kept"
  const undoable = slideUndoable(indexed, head.file, head.edit)
  for (const command of changed.turn) if (!(await storeCommand(deckId, command))) return "refused"
  await paint(undoable)
  return "stored"
}
