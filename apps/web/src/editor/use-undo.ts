import { slideKind, type SlideId, type Undoable } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { textFormatting } from "@airdesign/render"
import { useCallback, useEffect, useRef, useState } from "react"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import type { UndoButtonsState } from "@/editor/undo-buttons"
import { indexedRegister } from "@/editor/group-actions"
import { useUndoKeys } from "@/editor/undo-keys"
import { slideTurnSaid } from "@/editor/slide-said"
import type { DeckPaint } from "@/editor/use-deck-paint"
import { notesShown, type ShownNotes } from "@/notes-edit"
import { structureOf } from "@/table-hook"
import {
  emptyShown,
  emptyUndo,
  recorded,
  recordsInFlight,
  sameShown,
  shownOf,
  turnBack,
  undoLabel,
  type Typing,
  type UndoDirection,
  type UndoEntry,
  type UndoList as UndoSides,
} from "@/undo-list"

export type UndoList = ReturnType<typeof useUndoList>

export function useUndoList() {
  const undoList = useRef(emptyUndo)
  const turning = useRef<Promise<void>>(Promise.resolve())
  const shownNow = useRef(emptyShown)
  const [undoShown, setUndoShown] = useState(emptyShown)
  const typed = useRef<Typing | null>(null)
  const sessions = useRef(0)
  const records = useRef(recordsInFlight())
  const formatting = useRef(
    textFormatting(() => {
      typed.current = null
    }),
  )

  const show = useCallback((list: UndoSides, told: UndoDirection | null) => {
    const next = shownOf(list, told)
    undoList.current = list
    if (sameShown(next, shownNow.current)) return
    shownNow.current = next
    setUndoShown(next)
  }, [])

  function record(entry: UndoEntry) {
    show(recorded(undoList.current, entry), null)
  }

  function turnAfter(work: () => Promise<void>) {
    typed.current = null
    turning.current = turning.current.then(work)
  }

  return {
    undoList,
    turning,
    undoShown,
    show,
    told: undoShown.told,
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
  const { undoList, undoShown, show, told, typed, records, turnAfter } = undo
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
    const clear = window.setTimeout(() => show(undoList.current, null), 4000)
    return () => window.clearTimeout(clear)
  }, [told, show, undoList])

  function slideOf(undoable: Undoable): SlideId | null {
    if (!("slide" in undoable) || "elements" in undoable) return null
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
      show(turned.list, turned.outcome === "changed" ? direction : null)
      if (turned.outcome === "changed") return
      await showTurned(turned.entry, direction)
      void flushPending(connect, id).then(settle)
    })
  }

  useUndoKeys(deck.paintedDeck === id, turn)

  return {
    undoLabel: undoLabel("undo", undoShown),
    redoLabel: undoLabel("redo", undoShown),
    canUndo: undoShown.undo !== null,
    canRedo: undoShown.redo !== null,
    onUndo: () => turn("undo"),
    onRedo: () => turn("redo"),
  }
}
