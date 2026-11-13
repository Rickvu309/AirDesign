import { type ElementId, type Geometry, type Undoable } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { holdKeys, type HeldKeys } from "@airdesign/render"
import type { CommitOutcome } from "@/commit-edit"
import type { UndoName } from "@/copy/undo-copy"
import type { DeckPaint } from "@/editor/use-deck-paint"
import { commitElement, type ElementChange } from "@/element-edit"
import { commitPicture, type PictureFile } from "@/picture-add"
import type { PictureStore } from "@/picture-tool"
import type { UndoEntry } from "@/undo-list"
import { elementNames, stackNames } from "@/undo-names"

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

  function recordAdded(name: UndoName, keys?: HeldKeys) {
    return async (added: ElementId | null, undoable: Undoable | null) => {
      if (undoable !== null) record({ name, undoable })
      await showEdited(current)
      setEntering(added === null ? null : { id: added, ...(keys === undefined ? {} : { keys }) })
    }
  }

  async function changeElement(change: ElementChange): Promise<CommitOutcome | "closed"> {
    const keys = change.change === "remove" || change.change === "order" ? undefined : holdKeys(document)
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) {
      keys?.stop()
      return "closed"
    }
    const name = change.change === "order" ? stackNames[change.move] : elementNames[change.change]
    const outcome = await commitElement(id, shownParts.current, opened.register, change, recordAdded(name, keys))
    if (outcome === "refused") keys?.stop()
    settle(outcome)
    return outcome
  }

  function addText() {
    const size = canvases.current(current)
    if (size !== null) void changeElement({ change: "text", index: current, size })
  }

  function addShape(geometry: Geometry) {
    const size = canvases.current(current)
    if (size !== null) void changeElement({ change: "shape", geometry, index: current, size })
  }

  async function addPicture(picture: PictureFile) {
    const slide = canvases.current(current)
    if (slide === null) return
    const at = { index: current, slide, keep: pictureTool.store.keep }
    settle(await commitPicture(id, shownParts.current, picture, at, recordAdded("add-picture")))
  }

  return { changeElement, addText, addShape, addPicture }
}
