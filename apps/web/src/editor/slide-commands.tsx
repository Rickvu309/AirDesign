import { presentSlides, gridRows, type GridSide, type Undoable } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { SlideCanvas } from "@airdesign/render"
import type { CommitOutcome } from "@/commit-edit"
import { slideListCopy } from "@/copy/slide-list-copy"
import type { SlideStrip } from "@/editor/slide-sidebar"
import { showSlideDeleted, type UndoOf } from "@/editor/slide-toast"
import type { DeckPaint } from "@/editor/use-deck-paint"
import { fileSlides, commitSlideChange, type SlideChange } from "@/slide-edit"
import { thumbHeight } from "@/thumb-height"
import type { UndoEntry } from "@/undo-list"
import { slideNames } from "@/undo-names"

export type CommandedDeck = {
  readonly id: string
  readonly shown: DeckPaint
  readonly record: (entry: UndoEntry) => void
  readonly settle: (outcome: CommitOutcome) => void
  readonly undo: { readonly undoList: UndoOf["list"] }
  readonly setPending: (pending: boolean) => void
}

export function slideCommands(deck: CommandedDeck, undo: () => void): SlideStrip {
  const { id, record, settle, setPending } = deck
  const { store, shownParts, canvases, slideCount, sections, current, setCurrent, layouts, showEdited } = deck.shown

  let pending = Promise.resolve()

  async function changeSlide(
    change: SlideChange,
    index: number,
    to = index,
    layoutPart?: string,
    row: GridSide = "same",
  ) {
    const anchor = row === "new" ? sequence[index] : null
    const run = pending.then(async () => {
      const opened = await connect(memoryRemote()).openDeck(id)
      if (!opened.ok) return
      const painted = async (currentIndex: number, undoable: Undoable | null) => {
        if (undoable !== null) {
          const entry = { name: slideNames[change], undoable }
          record(entry)
          if (change === "remove") showSlideDeleted(index + 1, entry, { list: deck.undo.undoList, undo })
        }
        setPending(true)
        await showEdited(currentIndex)
        if (change === "add") deck.shown.saySlide.current(slideListCopy.added(currentIndex + 1))
      }
      const target =
        row === "new"
          ? presentSlides({
              file: fileSlides(shownParts.current, opened.register),
              order: opened.register.order,
            }).findIndex((slide) => slide.id === anchor)
          : index
      settle(
        await commitSlideChange(id, shownParts.current, opened.register, change, target, painted, to, layoutPart, row),
      )
    })
    pending = run.then(
      () => undefined,
      () => undefined,
    )
    await run
  }

  const register = deck.shown.shownRegister.current
  const file = fileSlides(shownParts.current, register ?? { file: [], order: [] })
  const state = { file, order: register?.order ?? [] }
  const sequence = presentSlides(state).map((spot) => spot.id)
  return {
    count: slideCount,
    gridStarts: gridRows(state).map((row) => sequence.indexOf(row[0])),
    sections,
    current,
    onSelect: setCurrent,
    onAdd: (layoutPart, after = current, row = "same") => void changeSlide("add", after, after, layoutPart, row),
    layouts,
    onClone: (index) => void changeSlide("clone", index),
    onRemove: (index) => void changeSlide("remove", index),
    onMove: (from, to) => void changeSlide("move", from, to),
    say: deck.shown.saySlide,
    thumbHeight: thumbHeight(canvases.current(0)),
    thumb: (index, width) => {
      const slide = canvases.current(index)
      return slide === null ? null : <SlideCanvas quiet slide={slide} store={store.current} width={width} />
    },
  }
}
