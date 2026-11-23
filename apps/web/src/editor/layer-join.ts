import {
  changeLayout,
  readSlideId,
  shapeOf,
  spotNow,
  type Command,
  type ElementId,
  type Register,
  type Undoable,
} from "@airdesign/document"
import { indexedRegister } from "@/editing/indexed-register"
import { fileSlides } from "@/editing/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

export type LayerJoin = {
  readonly change: "join"
  readonly node: ElementId
  readonly parent: ElementId | null
  readonly before: ElementId | null
  readonly from: ElementId | null
}

function joinTurn(
  parts: Parts,
  register: Register,
  node: ElementId,
  parent: ElementId | null,
  before: ElementId | null,
) {
  const file = fileSlides(parts, register)
  const changed = changeLayout(register, { move: node, frame: parent, before, file })
  return changed === null || !("turn" in changed) || changed.turn.length === 0 ? null : { file, turn: changed.turn }
}

export function layerJoins(parts: Parts, register: Register, node: ElementId, parent: ElementId | null): boolean {
  return joinTurn(parts, indexedRegister(parts, register), node, parent, null) !== null
}

export function joinPlanned(
  parts: Parts,
  register: Register,
  change: LayerJoin,
): { readonly commands: readonly Command[]; readonly undoable: Undoable } | null {
  const indexed = indexedRegister(parts, register)
  const slide = readSlideId(shapeOf(change.node).slide)
  const was = spotNow(indexed, change.node)
  const joined = joinTurn(parts, indexed, change.node, change.parent, change.before)
  if (slide === undefined || was === null || joined === null) return null
  const undoable: Undoable = {
    joined: change.node,
    slide,
    file: joined.file,
    before: { ...was, before: change.from },
    after: { frame: change.parent, before: change.before, box: was.box },
  }
  return { commands: joined.turn, undoable }
}
