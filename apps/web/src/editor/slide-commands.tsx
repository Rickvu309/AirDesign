import { toast } from "@/components/ui/toast"
import {
  limits,
  presentSlides,
  gridRows,
  gridCommandVersion,
  type ElementId,
  type GridSide,
  type Undoable,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { ownBox, SlideCanvas } from "@airdesign/render"
import type { CommitOutcome } from "@/commit-edit"
import { slideListCopy } from "@/copy/slide-list-copy"
import { gridAnchor } from "@/editor/grid-drop"
import type { SlideStrip } from "@/editor/slide-sidebar"
import { showSlideDeleted, type UndoOf } from "@/editor/slide-toast"
import type { DeckPaint } from "@/editor/use-deck-paint"
import { fileSlides, commitSlideChange, commitSlideMove, commitSlideSet, type SlideChange } from "@/slide-edit"
import { thumbHeight } from "@/thumb-height"
import type { UndoEntry } from "@/undo-list"
import { slideNames } from "@/undo-names"

export type CommandedDeck = {
  readonly id: string
  readonly matching?: readonly ElementId[]
  readonly shown: DeckPaint
  readonly record: (entry: UndoEntry) => void
  readonly settle: (outcome: CommitOutcome) => void
  readonly undo: { readonly undoList: UndoOf["list"] }
  readonly setPending: (pending: boolean) => void
}

export function slideCommands(deck: CommandedDeck, undo: () => void, showMatching = true): SlideStrip {
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
    await queue(async () => {
      const opened = await connect(memoryRemote()).openDeck(id)
      if (!opened.ok) return
      const painted = async (currentIndex: number, undoable: Undoable | null) => {
        if (undoable !== null) {
          const entry = { name: slideNames[change], undoable }
          record(entry)
          if (change === "remove")
            showSlideDeleted(slideListCopy.deleted(index + 1), entry, { list: deck.undo.undoList, undo })
        }
        setPending(true)
        await showEdited(currentIndex)
        if (change === "add") deck.shown.saySlide.current(slideListCopy.added(currentIndex + 1))
      }
      const target =
        row === "new"
          ? presentSlides({
              ...opened.register,
              file: fileSlides(shownParts.current, opened.register),
            }).findIndex((slide) => slide.id === anchor)
          : index
      settle(
        await commitSlideChange(id, shownParts.current, opened.register, change, target, painted, to, layoutPart, row),
      )
    })
  }

  function queue(work: () => Promise<void>) {
    const run = pending.then(work)
    pending = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const register = deck.shown.shownRegister.current
  const file = fileSlides(shownParts.current, register ?? { file: [], order: [] })
  const state = { ...register, file, order: register?.order ?? [] }
  const sequence = presentSlides(state).map((spot) => spot.id)
  return {
    count: slideCount,
    gridStarts: gridRows(state).map((row) => sequence.indexOf(row[0])),
    slideIds: sequence,
    sections,
    current,
    selectionBoxes: (ids) =>
      (canvases.current(current)?.elements ?? []).flatMap((element) => {
        if (element.id === null || !ids.includes(element.id)) return []
        const box = ownBox(element, store.current.getBox(element.id))
        return box === null ? [] : [box]
      }),
    onSelect: setCurrent,
    onAdd: (layoutPart, after = current, row = "same") => void changeSlide("add", after, after, layoutPart, row),
    layouts,
    onClone: (index) => void changeSlide("clone", index),
    onRemove: (index) => void changeSlide("remove", index),
    onMove: (from, to) => void changeSlide("move", from, to),
    onMoveMany: (held, at, row = "same") => {
      const ids = sequence.filter((_, index) => held.includes(index))
      const first = ids[0]
      if (first === undefined) return
      const anchor = gridAnchor(sequence, held, at, row)
      void queue(async () => {
        const opened = await connect(memoryRemote()).openDeck(id)
        if (!opened.ok) return
        const group = {
          slide: "move-many",
          grid: gridCommandVersion(opened.register),
          ids: [first, ...ids.slice(1)],
        } as const
        const edit =
          row === "before"
            ? anchor === null
              ? null
              : { ...group, row, before: anchor }
            : { ...group, row, after: anchor }
        if (edit === null) return
        settle(
          await commitSlideMove(id, file, opened.register, edit, async (currentIndex, undoable) => {
            if (undoable !== null) record({ name: slideNames.move, undoable })
            setPending(true)
            await showEdited(currentIndex)
          }),
        )
      })
    },
    onChangeSet: (change, held, paint) => {
      const ids = sequence.filter((_, index) => held.includes(index))
      const [first, ...rest] = ids
      if (first === undefined) return
      void queue(async () => {
        const opened = await connect(memoryRemote()).openDeck(id)
        if (!opened.ok) return
        const result = await commitSlideSet(
          id,
          shownParts.current,
          opened.register,
          change,
          [first, ...rest],
          async (currentIndex, copies, undoable) => {
            const entry = { name: slideNames[change], undoable }
            record(entry)
            if (change === "remove")
              showSlideDeleted(slideListCopy.deletedSet(ids.length), entry, { list: deck.undo.undoList, undo })
            setPending(true)
            paint(copies)
            await showEdited(currentIndex)
          },
        )
        if (result.ok) settle(result.outcome)
        else
          toast.error(
            result.message === "slideLimit" ? slideListCopy.slideLimit(limits.slides) : slideListCopy[result.message],
          )
      })
    },
    say: deck.shown.saySlide,
    thumbHeight: thumbHeight(canvases.current(0)),
    thumb: (index, width) => {
      const slide = canvases.current(index)
      const highlights = showMatching && deck.matching?.length ? deck.matching : undefined
      return slide === null ? null : (
        <SlideCanvas quiet slide={slide} store={store.current} width={width} {...(highlights && { highlights })} />
      )
    },
  }
}
