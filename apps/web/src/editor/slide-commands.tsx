import { type Undoable } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { SlideCanvas } from "@airdesign/render"
import type { CommitOutcome } from "@/commit-edit"
import type { SlideStrip } from "@/editor/slide-sidebar"
import type { DeckPaint } from "@/editor/use-deck-paint"
import { commitSlideChange, type SlideChange } from "@/slide-edit"
import { thumbHeight } from "@/thumb-height"
import type { UndoEntry } from "@/undo-list"
import { slideNames } from "@/undo-names"

export type CommandedDeck = {
  readonly id: string
  readonly shown: DeckPaint
  readonly record: (entry: UndoEntry) => void
  readonly settle: (outcome: CommitOutcome) => void
}

export function slideCommands(deck: CommandedDeck): SlideStrip {
  const { id, record, settle } = deck
  const { store, shownParts, canvases, slideCount, sections, current, setCurrent, layouts, showEdited } = deck.shown

  async function changeSlide(change: SlideChange, index: number, to = index, layoutPart?: string) {
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) return
    const painted = async (currentIndex: number, undoable: Undoable | null) => {
      if (undoable !== null) record({ name: slideNames[change], undoable })
      await showEdited(currentIndex)
    }
    settle(await commitSlideChange(id, shownParts.current, opened.register, change, index, painted, to, layoutPart))
  }

  return {
    count: slideCount,
    sections,
    current,
    onSelect: setCurrent,
    onAdd: (layoutPart, after = current) => void changeSlide("add", after, after, layoutPart),
    layouts,
    onClone: (index) => void changeSlide("clone", index),
    onRemove: (index) => void changeSlide("remove", index),
    onMove: (from, to) => void changeSlide("move", from, to),
    thumbHeight: thumbHeight(canvases.current(0)),
    thumb: (index, width) => {
      const slide = canvases.current(index)
      return slide === null ? null : <SlideCanvas quiet slide={slide} store={store.current} width={width} />
    },
  }
}
