import { slideKind, type SlideId, type Undoable } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { textFormatting } from "@airdesign/render"
import { useCallback, useEffect, useRef, useState } from "react"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import type { UndoButtonsState } from "@/editor/undo-buttons"
import { indexedRegister } from "@/indexed-register"
import { storeLane } from "@/editor/store-lane"
import { useUndoKeys } from "@/editor/undo-keys"
import { slideTurnSaid } from "@/editor/slide-said"
import { withFileFloors } from "@/deck-paint"
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
  const focused = useRef<number | null>(null)
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

  const records = useRef(recordsInFlight((entry) => show(recorded(undoList.current, entry), null)))
  const [lane] = useState(storeLane)

  function turnAfter<Result>(work: () => Promise<Result>): Promise<Result> {
    typed.current = null
    const inserted = lane.stored()
    const turn = turning.current.then(() => inserted).then(work)
    turning.current = turn.then(
      () => undefined,
      () => undefined,
    )
    return turn
  }

  return {
    undoList,
    turning,
    lane,
    undoShown,
    show,
    told: undoShown.told,
    typed,
    sessions,
    focused,
    records,
    formatting,
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
}

export function useUndoTurn(deck: TurningDeck): UndoButtonsState {
  const { id, undo, shown, notesBar, settle } = deck
  const [gridFocus, setGridFocus] = useState({ turn: 0, visible: false })
  const { undoList, undoShown, show, told, typed, sessions, focused, records, turnAfter } = undo
  const { store, shownParts, structure, bound, repaint, setCurrent, showRegister } = shown

  useEffect(() => {
    function openSession(event: FocusEvent) {
      if (!(event.target instanceof Element) || event.target.closest("[data-session]") === null) return
      sessions.current += 1
      focused.current = sessions.current
    }
    function closeSession() {
      typed.current = null
      focused.current = null
    }
    window.addEventListener("focusin", openSession)
    window.addEventListener("focusout", closeSession)
    return () => {
      window.removeEventListener("focusin", openSession)
      window.removeEventListener("focusout", closeSession)
    }
  }, [typed, sessions, focused])

  useEffect(() => {
    if (told === null) return
    const clear = window.setTimeout(() => show(undoList.current, null), 4000)
    return () => window.clearTimeout(clear)
  }, [told, show, undoList])

  function slideOf(undoable: Undoable): SlideId | null {
    if ("spots" in undoable) return undoable.spots[0]?.id ?? null
    if (!("slide" in undoable) || "elements" in undoable) return null
    return undoable.slide
  }

  async function showTurned(
    entry: UndoEntry,
    direction: UndoDirection,
    grid: Element | null | undefined,
    visible: boolean,
  ) {
    const { undoable } = entry
    const held = shown.current
    const slideId = slideOf(undoable)
    const before = slideId === null ? -1 : store.current.slides().findIndex((slide) => slide.id === slideId)
    const next = await connect(memoryRemote()).openDeck(id)
    if (!next.ok) return
    const framed = withFileFloors(shown.paintedOf(next.register), shownParts.current)
    if ("slide" in undoable || "spots" in undoable || structure.current !== structureOf(framed, bound.current))
      showRegister(next.register)
    repaint.current(next.register, "person")
    const nodes = "steps" in undoable ? undoable.steps.map((step) => step.node) : []
    if (nodes.some((node) => slideKind(node) === "notes")) notesBar.show(notesShown(shownParts.current, next.register))
    const slides = store.current.slides()
    const after = slideId === null ? -1 : slides.findIndex((slide) => slide.id === slideId)
    const said = slideTurnSaid(direction, entry.name, { before, after, count: slides.length, held })
    if (said !== null) shown.saySlide?.current(said)
    const shownSlide =
      slideId !== null
        ? slides.findIndex((slide) => slide.id === slideId)
        : slides.findIndex((slide) => nodes.some((node) => node.startsWith(`${slide.id}.`)))
    setCurrent((index) => (shownSlide >= 0 ? shownSlide : Math.max(0, Math.min(index, slides.length - 1))))
    if (grid?.isConnected && (grid.contains(document.activeElement) || document.activeElement === document.body))
      setGridFocus((focus) => ({ turn: focus.turn + 1, visible }))
  }

  function turn(direction: UndoDirection, visible = false) {
    const grid = document.activeElement?.closest("[data-editor-grid]")
    turnAfter(async () => {
      await records.current.landed()
      const turned = await turnBack(connect(memoryRemote()), id, undoList.current, direction, (register) =>
        indexedRegister(shownParts.current, register),
      )
      if (turned.outcome === "empty") return
      show(turned.list, turned.outcome === "changed" ? direction : null)
      if (turned.outcome === "changed") return
      await showTurned(turned.entry, direction, grid, visible)
      void flushPending(connect, id).then(settle)
    })
  }

  useUndoKeys(deck.paintedDeck === id, (direction) => turn(direction, true))

  return {
    undoLabel: undoLabel("undo", undoShown),
    redoLabel: undoLabel("redo", undoShown),
    gridTurn: gridFocus.turn,
    gridFocusVisible: gridFocus.visible,
    canUndo: undoShown.undo !== null,
    canRedo: undoShown.redo !== null,
    onUndo: () => turn("undo"),
    onRedo: () => turn("redo"),
  }
}
