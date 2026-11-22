import { elementId, type Register } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { readNotes, type SlideNotes } from "@airdesign/pptx"
import { toast } from "@/components/ui/toast"
import { useState, type RefObject } from "react"
import { commitKept, type CommitOutcome } from "@/editing/commit-edit"
import { exportedParts } from "@/editing/exported-parts"
import type { RecordsInFlight, Typing } from "@/editing/undo-list"

type Parts = ReadonlyMap<string, Uint8Array>

export type ShownNotes = Pick<SlideNotes, "slide" | "text">

export type NotesDeck = {
  readonly id: string
  readonly typed: RefObject<Typing | null>
  readonly sessions: RefObject<number>
  readonly records: RefObject<RecordsInFlight>
  readonly settle: (outcome: CommitOutcome) => void
}

export function notesShown(parts: Parts, register: Register | null): readonly ShownNotes[] {
  return readNotes(register === null ? parts : exportedParts(parts, register))
}

export function useNotes(deck: NotesDeck) {
  const [notes, setNotes] = useState<readonly ShownNotes[]>([])

  function show(next: readonly ShownNotes[]) {
    const typing = deck.typed.current?.node
    setNotes((rows) =>
      next.map((row) =>
        typing === elementId(`${row.slide}.notes`) ? (rows.find((kept) => kept.slide === row.slide) ?? row) : row,
      ),
    )
  }

  function edit(slide: string | undefined, value: string) {
    if (slide === undefined) return
    const node = elementId(`${slide}.notes`)
    const floor = notes.find((row) => row.slide === slide)?.text ?? ""
    if (deck.typed.current?.node !== node) {
      deck.sessions.current += 1
      deck.typed.current = { node, session: deck.sessions.current, before: Promise.resolve(floor) }
    }
    const { session, before } = deck.typed.current
    setNotes((shown) => [...shown.filter((row) => row.slide !== slide), { slide, text: value }])
    const slot = deck.records.current.hold()
    const kept = connect(memoryRemote()).enqueue(deck.id, value, node, floor)
    void commitKept(connect, deck.id, kept, async () => {
      const from = await before
      slot.record({
        name: "notes",
        session,
        undoable: {
          steps: [{ node, before: { notes: { value: { set: from } } }, after: { notes: { value: { set: value } } } }],
        },
      })
    })
      .then((outcome) => {
        if (outcome === "refused")
          toast.error("Unable to save presenter notes", {
            id: "notes-refused",
            description: "Copy your notes, reload the deck and try again.",
          })
        deck.settle(outcome)
      })
      .finally(slot.release)
  }

  return { notes, show, edit }
}
