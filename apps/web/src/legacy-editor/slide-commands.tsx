import { toast } from "@/components/ui/toast"
import {
  limits,
  presentSlides,
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
import type { DeckPaint } from "@/editor/use-deck-paint"
import { fileSlides, commitSlideChange, commitSlideMove, commitSlideSet, type SlideChange } from "@/slide-edit"
import { thumbHeight } from "@/thumb-height"
import type { UndoList } from "@/editor/use-undo"
import { slideNames } from "@/undo-names"

export type CommandedDeck = {
  readonly id: string
  readonly matching?: readonly ElementId[]
  readonly shown: DeckPaint
  readonly undo: Pick<UndoList, "records" | "lane" | "slideLane">
  readonly settle: (outcome: CommitOutcome) => void
}

export function slideCommands(deck: CommandedDeck, showMatching = true): SlideStrip {
  const { id, settle } = deck
  const hold = () => deck.undo.records.current.hold()
  const { store, shownParts, canvases, slideCount, groups, current, setCurrent, layouts, showEdited } = deck.shown
  const { slideLane } = deck.undo

  async function changeSlide(
    change: SlideChange,
    index: number,
    to = index,
    layoutPart?: string,
    placement: GridSide = "same",
  ) {
    const anchor = placement === "new" ? sequence[index] : null
    const slot = hold()
    const inserted = deck.undo.lane.stored()
    await slideLane(async (stored) => {
      await inserted
      const opened = await connect(memoryRemote()).openDeck(id)
      if (!opened.ok) return
      const painted = async (currentIndex: number, undoable: Undoable | null) => {
        stored()
        if (undoable !== null) {
          slot.record({ name: slideNames[change], undoable })
        }
        await showEdited(currentIndex)
        if (change === "add") deck.shown.saySlide.current(slideListCopy.added(currentIndex + 1))
      }
      const target =
        placement === "new"
          ? presentSlides({
              ...opened.register,
              file: fileSlides(shownParts.current, opened.register),
            }).findIndex((slide) => slide.id === anchor)
          : index
      settle(
        await commitSlideChange(
          id,
          shownParts.current,
          opened.register,
          change,
          target,
          painted,
          to,
          layoutPart,
          placement,
        ),
      )
    }).finally(slot.release)
  }

  const register = deck.shown.shownRegister.current
  const file = fileSlides(shownParts.current, register ?? { file: [], order: [] })
  const state = { ...register, file, order: register?.order ?? [] }
  const sequence = presentSlides(state).map((spot) => spot.id)
  return {
    count: slideCount,
    slideIds: sequence,
    groups,
    current,
    selectionBoxes: (ids) =>
      (canvases.current(current)?.elements ?? []).flatMap((element) => {
        if (element.id === null || !ids.includes(element.id)) return []
        const box = ownBox(element, store.current.getBox(element.id))
        return box === null ? [] : [box]
      }),
    onSelect: setCurrent,
    onAdd: (layoutPart, after = current, placement = "same") =>
      void changeSlide("add", after, after, layoutPart, placement),
    layouts,
    onClone: (index) => void changeSlide("clone", index),
    onRemove: (index) => void changeSlide("remove", index),
    onMove: (from, to) => void changeSlide("move", from, to),
    onMoveMany: (held, at, placement = "same") => {
      const ids = sequence.filter((_, index) => held.includes(index))
      const first = ids[0]
      if (first === undefined) return
      const anchor = gridAnchor(sequence, held, at, placement)
      const slot = hold()
      void slideLane(async (stored) => {
        const opened = await connect(memoryRemote()).openDeck(id)
        if (!opened.ok) return
        const base = {
          slide: "move-many",
          grid: gridCommandVersion(opened.register),
          ids: [first, ...ids.slice(1)],
        } as const
        const edit =
          placement === "before"
            ? anchor === null
              ? null
              : { ...base, row: placement, before: anchor }
            : { ...base, row: placement, after: anchor }
        if (edit === null) return
        settle(
          await commitSlideMove(id, file, opened.register, edit, async (currentIndex, undoable) => {
            stored()
            if (undoable !== null) slot.record({ name: slideNames.move, undoable })
            await showEdited(currentIndex)
          }),
        )
      }).finally(slot.release)
    },
    onChangeSet: (change, held, paint) => {
      const ids = sequence.filter((_, index) => held.includes(index))
      const [first, ...rest] = ids
      if (first === undefined) return
      const slot = hold()
      void slideLane(async (stored) => {
        const opened = await connect(memoryRemote()).openDeck(id)
        if (!opened.ok) return
        const result = await commitSlideSet(
          id,
          shownParts.current,
          opened.register,
          change,
          [first, ...rest],
          async (currentIndex, copies, undoable) => {
            stored()
            slot.record({ name: slideNames[change], undoable })
            paint(copies)
            await showEdited(currentIndex)
          },
        )
        if (result.ok) settle(result.outcome)
        else
          toast.error(
            result.message === "slideLimit" ? slideListCopy.slideLimit(limits.slides) : slideListCopy[result.message],
          )
      }).finally(slot.release)
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
