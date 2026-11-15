import { slideKind, type SlideId, type Undoable } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { textFormatting } from "@airdesign/render"
import { useEffect, useRef, useState } from "react"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import type { UndoButtonsState } from "@/editor/undo-buttons"
import { indexedRegister } from "@/editor/group-actions"
import { useUndoKeys } from "@/editor/undo-keys"
import { slideTurnSaid } from "@/editor/slide-said"
import type { DeckPaint } from "@/editor/use-deck-paint"
import { notesShown, type ShownNotes } from "@/notes-edit"
import { structureOf } from "@/table-hook"
import {
  emptyUndo,
  recorded,
  recordsInFlight,
  turnBack,
  undoLabel,
  type Typing,
  type UndoDirection,
  type UndoEntry,
} from "@/undo-list"

export type UndoList = ReturnType<typeof useUndoList>

export function useUndoList() {
  const undoList = useRef(emptyUndo)
  const turning = useRef<Promise<void>>(Promise.resolve())
  const [undoShown, setUndoShown] = useState(emptyUndo)
  const [told, setTold] = useState<UndoDirection | null>(null)
  const typed = useRef<Typing | null>(null)
  const sessions = useRef(0)
  const records = useRef(recordsInFlight())
  const formatting = useRef(
    textFormatting(() => {
      typed.current = null
    }),
  )

  function record(entry: UndoEntry) {
    undoList.current = recorded(undoList.current, entry)
    setUndoShown(undoList.current)
    setTold(null)
  }

  function turnAfter(work: () => Promise<void>) {
    typed.current = null
    turning.current = turning.current.then(work)
  }

  return {
    undoList,
    turning,
    undoShown,
    setUndoShown,
    told,
    setTold,
    typed,
    sessions,
    records,
    formatting,
    record,
    turnAfter,
  }
}

export type TurningDeck = {
  readonly id: string
  readonly paintedDeck: string | undefined
  readonly undo: UndoList
  readonly shown: DeckPaint
  readonly notesBar: {
    readonly show: (notes: readonly ShownNotes[]) => void
  }
  readonly settle: (outcome: CommitOutcome) => void
  readonly setPending: (pending: boolean) => void
}

export function useUndoTurn(deck: TurningDeck): UndoButtonsState {
  const { id, undo, shown, notesBar, settle, setPending } = deck
  const { undoList, undoShown, setUndoShown, told, setTold, typed, records, turnAfter } = undo
  const { store, shownParts, structure, bound, repaint, setCurrent, showRegister } = shown

  useEffect(() => {
    function closeSession() {
      typed.current = null
    }
    window.addEventListener("focusout", closeSession)
    return () => window.removeEventListener("focusout", closeSession)
  }, [typed])

  useEffect(() => {
    if (told === null) return
    const clear = window.setTimeout(() => setTold(null), 4000)
    return () => window.clearTimeout(clear)
  }, [told, setTold])

  function slideOf(undoable: Undoable): SlideId | null {
    if (!("slide" in undoable) || "element" in undoable) return null
    return undoable.slide
  }

  async function showTurned(entry: UndoEntry, direction: UndoDirection) {
    const { undoable } = entry
    const held = shown.current
    const slideId = slideOf(undoable)
    const before = slideId === null ? -1 : store.current.slides().findIndex((slide) => slide.id === slideId)
    const next = await connect(memoryRemote()).openDeck(id)
    if (!next.ok) return
    if ("slide" in undoable || structure.current !== structureOf(next.register, bound.current))
      showRegister(next.register)
    repaint.current(next.register, "person")
    const nodes = "steps" in undoable ? undoable.steps.map((step) => step.node) : []
    if (nodes.some((node) => slideKind(node) === "notes")) notesBar.show(notesShown(shownParts.current, next.register))
    const slides = store.current.slides()
    const after = slideId === null ? -1 : slides.findIndex((slide) => slide.id === slideId)
    const said = slideTurnSaid(direction, entry.name, { before, after, count: slides.length, held })
    if (said !== null) shown.saySlide?.current(said)
    const shownSlide =
      "slide" in undoable
        ? slides.findIndex((slide) => slide.id === undoable.slide)
        : slides.findIndex((slide) => nodes.some((node) => node.startsWith(`${slide.id}.`)))
    setCurrent((index) => (shownSlide >= 0 ? shownSlide : Math.max(0, Math.min(index, slides.length - 1))))
    setPending(true)
  }

  function turn(direction: UndoDirection) {
    turnAfter(async () => {
      await records.current.landed()
      const turned = await turnBack(connect(memoryRemote()), id, undoList.current, direction, (register) =>
        indexedRegister(shownParts.current, register),
      )
      if (turned.outcome === "empty") return
      undoList.current = turned.list
      setUndoShown(turned.list)
      setTold(turned.outcome === "changed" ? direction : null)
      if (turned.outcome === "changed") return
      await showTurned(turned.entry, direction)
      void flushPending(connect, id).then(settle)
    })
  }

  useUndoKeys(deck.paintedDeck === id, turn)

  return {
    undoLabel: undoLabel("undo", undoShown),
    redoLabel: undoLabel("redo", undoShown),
    canUndo: undoShown.undo.length > 0,
    canRedo: undoShown.redo.length > 0,
    onUndo: () => turn("undo"),
    onRedo: () => turn("redo"),
  }
}
