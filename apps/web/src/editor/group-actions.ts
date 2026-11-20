import {
  beforeOf,
  changeLayout,
  format,
  landedPatch,
  elementId,
  groupOf,
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

export function groupCommands(parts: Parts, register: Register, change: GroupChange): readonly Command[] | null {
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
  if (change.change === "group") {
    const command = groupOf(register, slide, node, change.nodes)
    return command === null ? null : [{ command: "slide", file, edit: command }]
  }
  const backdrop = elementId(`${slide}.${String(Number(shapeOf(node).shape) + 1)}`)
  if (change.change === "plain-frame") return plainFrameTurn(register, file, slide, node, backdrop, change.nodes)
  const framed = changeLayout(register, { wrap: change.nodes, slide, node, backdrop })
  return framed === null || !("slide" in framed) ? null : [{ command: "slide", file, edit: framed.slide }]
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
  const commands = groupCommands(parts, indexed, change)
  const head = commands?.[0]
  if (commands === null || head === undefined) return "refused"
  const undoable =
    head.command === "slide" ? slideUndoable(indexed, head.file, head.edit) : { steps: rowSteps(indexed, commands) }
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
): Promise<CommitOutcome | "moved" | "kept"> {
  const indexed = indexedRegister(parts, register)
  const file = fileSlides(parts, register)
  const changed = changeLayout(indexed, { place: node, box, file })
  if (changed === null || !("turn" in changed)) return "moved"
  const head = changed.turn[0]
  if (head?.command !== "slide") return "kept"
  const undoable = slideUndoable(indexed, head.file, head.edit)
  for (const command of changed.turn) if (!(await sent(deckId, command))) return "refused"
  await paint(undoable)
  return flushPending(connect, deckId)
}
