import { elementId, type Register } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { readNotes, type SlideNotes } from "@airdesign/pptx"
import { toast } from "sonner"
import { useRef, useState, type RefObject } from "react"
import { commitKept, type CommitOutcome } from "@/commit-edit"
import { exportedParts } from "@/exported-parts"
import type { Typing, UndoEntry } from "@/undo-list"

type Parts = ReadonlyMap<string, Uint8Array>

export type ShownNotes = Pick<SlideNotes, "slide" | "text">

export type NotesDeck = {
  readonly id: string
  readonly typed: RefObject<Typing | null>
  readonly sessions: RefObject<number>
  readonly record: (entry: UndoEntry) => void
  readonly settle: (outcome: CommitOutcome) => void
  readonly sending: () => void
}

export function notesShown(parts: Parts, register: Register | null): readonly ShownNotes[] {
  return readNotes(register === null ? parts : exportedParts(parts, register))
}

export function useNotes(deck: NotesDeck) {
  const [notes, show] = useState<readonly ShownNotes[]>([])
  const queue = useRef(Promise.resolve())

  function edit(slide: string | undefined, value: string) {
    if (slide === undefined) return
    const node = elementId(`${slide}.notes`)
    const floor = notes.find((row) => row.slide === slide)?.text ?? ""
    if (deck.typed.current?.node !== node) {
      deck.sessions.current += 1
      deck.typed.current = { node, session: deck.sessions.current, before: Promise.resolve(floor) }
    }
    const { session, before } = deck.typed.current
    show((shown) => [...shown.filter((row) => row.slide !== slide), { slide, text: value }])
    const kept = connect(memoryRemote()).enqueue(deck.id, value, node, floor)
    queue.current = queue.current.then(async () => {
      const outcome = await commitKept(connect, deck.id, kept, async () => {
        const from = await before
        deck.sending()
        deck.record({
          name: "notes",
          session,
          undoable: { node, floor: from, before: { value: from }, after: { value } },
        })
      })
      if (outcome === "refused")
        toast.error("Unable to save speaker notes", { description: "Copy your notes, reload the deck and try again." })
      deck.settle(outcome)
    })
  }

  return { notes, show, queue, edit }
}
