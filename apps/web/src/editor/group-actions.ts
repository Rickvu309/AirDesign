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
import { connect, memoryRemote } from "@airdesign/live"
import { freeShapeId, readSlides } from "@airdesign/pptx"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { slideBase } from "@/exported-parts"
import { indexedRegister } from "@/indexed-register"
import { fileSlides } from "@/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

export type GroupChange =
  | { readonly change: "group"; readonly nodes: readonly ElementId[] }
  | { readonly change: "ungroup"; readonly node: ElementId }
  | { readonly change: "frame"; readonly nodes: readonly ElementId[] }
  | { readonly change: "plain-frame"; readonly nodes: readonly ElementId[] }
  | { readonly change: "mask"; readonly nodes: readonly ElementId[]; readonly mask: ElementId }

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
  if (change.change === "mask") return maskTurn(register, file, slide, node, change.nodes, change.mask)
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

async function sent(deckId: string, command: Command): Promise<boolean> {
  const link = connect(memoryRemote())
  if (command.command === "slide") return (await link.enqueueSlide(deckId, command.file, command.edit)).ok
  if (command.command !== "person" || command.node === undefined || command.v === undefined) return false
  return (await link.enqueueRow(deckId, { v: command.v, patch: command.patch }, command.node, "")).ok
}

export async function commitGroup(
  deckId: string,
  parts: Parts,
  register: Register,
  change: GroupChange,
  paint: (group: ElementId | null, undoable: Undoable | null) => void | Promise<void>,
): Promise<CommitOutcome> {
  const indexed = indexedRegister(parts, register)
  const planned = groupPlan(parts, indexed, change)
  const head = planned?.commands[0]
  if (planned === null || head === undefined) return "refused"
  const { commands, undoable } = planned
  for (const command of commands) if (!(await sent(deckId, command))) return "refused"
  const made = head.command === "slide" && head.edit.slide === "element-group" ? head.edit.element.node : null
  await paint(made, undoable)
  return flushPending(connect, deckId)
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
  for (const command of changed.turn) if (!(await sent(deckId, command))) return "refused"
  await paint(undoable)
  return "stored"
}
