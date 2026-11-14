import { slideUndoable, type Register, type Color, type SlideId, type Undoable } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { fileSlides } from "@/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

export async function commitBackground(
  deckId: string,
  parts: Parts,
  register: Register,
  slide: SlideId,
  color: Color,
  paint: (undoable: Undoable) => Promise<void>,
): Promise<CommitOutcome> {
  const file = fileSlides(parts, register)
  const edit = { slide: "background", id: slide, color } as const
  const undoable = slideUndoable(register, file, edit)
  if (undoable === null) return "refused"
  const kept = await connect(memoryRemote()).enqueueSlide(deckId, file, edit)
  if (!kept.ok) return "refused"
  await paint(undoable)
  return flushPending(connect, deckId)
}
