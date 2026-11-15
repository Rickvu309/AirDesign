import {
  groupOf,
  nextElementId,
  readSlideId,
  shapeOf,
  slideUndoable,
  ungroupTurn,
  type Command,
  type DeckIndex,
  type ElementId,
  type Register,
  type Undoable,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { freeShapeId, readSlides } from "@airdesign/pptx"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { slideBase } from "@/exported-parts"
import { designedParts } from "@/index-deck"
import { fileSlides } from "@/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

const indexes = new WeakMap<Parts, DeckIndex>()

export function indexedRegister(parts: Parts, register: Register): Register {
  const held = register.index
  if (held !== undefined && held.total === held.elements.length) return register
  const kept = indexes.get(parts)
  if (kept !== undefined) return { ...register, index: kept }
  const { palettes, slides, elements } = designedParts(parts)
  const index: DeckIndex = {
    total: elements.length,
    slides,
    elements,
    ...(palettes === undefined ? {} : { palettes }),
    pages: [],
  }
  indexes.set(parts, index)
  return { ...register, index }
}

export type GroupChange =
  | { readonly change: "group"; readonly nodes: readonly ElementId[] }
  | { readonly change: "ungroup"; readonly node: ElementId }

export function groupCommands(parts: Parts, register: Register, change: GroupChange): readonly Command[] | null {
  const base = slideBase(parts, register)
  const file = fileSlides(parts, register)
  const first = change.change === "group" ? change.nodes[0] : change.node
  const slide = first === undefined ? undefined : readSlideId(shapeOf(first).slide)
  if (slide === undefined) return null
  if (change.change === "ungroup") return ungroupTurn(register, file, slide, change.node)
  const found = readSlides(base).find((each) => each.slide === slide)
  if (found === undefined) return null
  const command = groupOf(register, slide, nextElementId(register, slide, freeShapeId(base, found.part)), change.nodes)
  return command === null ? null : [{ command: "slide", file, edit: command }]
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
  if (commands === null || head?.command !== "slide") return "refused"
  const undoable = slideUndoable(indexed, head.file, head.edit)
  for (const command of commands) if (!(await sent(deckId, command))) return "refused"
  await paint(head.edit.slide === "element-group" ? head.edit.element.node : null, undoable)
  return flushPending(connect, deckId)
}
