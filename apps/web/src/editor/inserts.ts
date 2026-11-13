import { type ElementId, type Undoable } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import type { CommitOutcome } from "@/commit-edit"
import type { UndoName } from "@/copy/undo-copy"
import type { DeckPaint } from "@/editor/use-deck-paint"
import { commitElement, type ElementChange } from "@/element-edit"
import { commitPicture, type PictureFile } from "@/picture-add"
import type { PictureStore } from "@/picture-tool"
import type { UndoEntry } from "@/undo-list"
import { elementNames } from "@/undo-names"

export type InsertingDeck = {
  readonly id: string
  readonly shown: DeckPaint
  readonly pictureTool: { readonly store: PictureStore }
  readonly record: (entry: UndoEntry) => void
  readonly settle: (outcome: CommitOutcome) => void
}

export function deckInserts(deck: InsertingDeck) {
  const { id, pictureTool, record, settle } = deck
  const { shownParts, canvases, current, setEntering, showEdited } = deck.shown

  function recordAdded(name: UndoName) {
    return async (added: ElementId | null, undoable: Undoable | null) => {
      if (undoable !== null) record({ name, undoable })
      await showEdited(current)
      setEntering(added)
    }
  }

  async function changeElement(change: ElementChange) {
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) return
    settle(
      await commitElement(id, shownParts.current, opened.register, change, recordAdded(elementNames[change.change])),
    )
  }

  function addText() {
    const size = canvases.current(current)
    if (size !== null) void changeElement({ change: "text", index: current, size })
  }

  async function addPicture(picture: PictureFile) {
    const slide = canvases.current(current)
    if (slide === null) return
    const at = { index: current, slide, keep: pictureTool.store.keep }
    settle(await commitPicture(id, shownParts.current, picture, at, recordAdded("add-picture")))
  }

  return { changeElement, addText, addPicture }
}
