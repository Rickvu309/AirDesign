import {
  changeLayout,
  readSlideId,
  shapeOf,
  spotNow,
  type ElementId,
  type Register,
  type Undoable,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { indexedRegister } from "@/indexed-register"
import { fileSlides } from "@/slide-edit"

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

export async function commitJoin(
  deckId: string,
  parts: Parts,
  register: Register,
  change: LayerJoin,
  paint: (added: ElementId | null, undoable: Undoable | null) => void | Promise<void>,
): Promise<CommitOutcome> {
  const indexed = indexedRegister(parts, register)
  const slide = readSlideId(shapeOf(change.node).slide)
  const was = spotNow(indexed, change.node)
  const joined = joinTurn(parts, indexed, change.node, change.parent, change.before)
  if (slide === undefined || was === null || joined === null) return "refused"
  const link = connect(memoryRemote())
  for (const command of joined.turn) {
    const kept =
      command.command === "slide"
        ? await link.enqueueSlide(deckId, command.file, command.edit)
        : command.command === "person" && command.node !== undefined && command.v !== undefined
          ? await link.enqueueRow(deckId, { v: command.v, patch: command.patch }, command.node, "")
          : { ok: false }
    if (!kept.ok) return "refused"
  }
  const undoable: Undoable = {
    joined: change.node,
    slide,
    file: joined.file,
    before: { ...was, before: change.from },
    after: { frame: change.parent, before: change.before, box: was.box },
  }
  await paint(null, undoable)
  return flushPending(connect, deckId)
}
