import { type ElementId, type Geometry, type Undoable } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { holdKeys, type Copied, type HeldKeys, type Moved } from "@airdesign/render"
import type { CommitOutcome } from "@/commit-edit"
import type { UndoName } from "@/copy/undo-copy"
import type { DeckPaint } from "@/editor/use-deck-paint"
import { elementCopy } from "@/copy/element-copy"
import { commitCopies, commitElement, type CopyAsked, type ElementChange } from "@/element-edit"
import { commitIcon, commitPicture, type PictureFile } from "@/picture-add"
import type { PictureStore } from "@/picture-tool"
import type { UndoEntry } from "@/undo-list"
import { elementNames, stackNames } from "@/undo-names"

import { addSlideNumbers } from "./slide-number-actions"

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

  async function changeElement(change: ElementChange, named?: UndoName): Promise<CommitOutcome | "closed"> {
    const typed = change.change === "text" || change.change === "table" || change.change === "shape"
    const keys = typed ? holdKeys(document) : undefined
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) {
      keys?.stop()
      return "closed"
    }
    const name =
      named ??
      (change.change !== "order"
        ? elementNames[change.change]
        : typeof change.move === "string"
          ? stackNames[change.move]
          : "layer-order")
    const outcome = await commitElement(id, shownParts.current, opened.register, change, recordAdded(name, keys))
    if (outcome === "refused") keys?.stop()
    settle(outcome)
    return outcome
  }

  async function copyLayers(copies: readonly CopyAsked[], name: UndoName, title?: string): Promise<readonly Copied[]> {
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) return []
    const paint = async (undoable: Undoable | null) => {
      if (undoable !== null) record({ name, undoable })
      await showEdited(current)
    }
    const made = await commitCopies(id, shownParts.current, opened.register, copies, paint, title)
    void made.flushed.then(settle)
    return made.copies
  }

  function duplicateLayers(copies: readonly Moved[]): Promise<readonly Copied[]> {
    return copyLayers(copies, "duplicate-layer")
  }

  function pasteLayers(copies: readonly CopyAsked[]): Promise<readonly Copied[]> {
    return copyLayers(copies, "paste-layer", elementCopy.pasteRefusedTitle)
  }

  function cutLayers(nodes: readonly ElementId[]) {
    return changeElement({ change: "remove", nodes }, "cut-layer")
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

  async function addIcon(name: string) {
    const slide = canvases.current(current)
    if (slide === null) return
    const at = { index: current, slide, keep: pictureTool.store.keep }
    settle(await commitIcon(id, shownParts.current, name, at, recordAdded("add-icon")))
  }

  return {
    changeElement,
    duplicateLayers,
    pasteLayers,
    cutLayers,
    addText,
    addShape,
    addPicture,
    addIcon,
    addSlideNumber: () => void addSlideNumbers(deck),
  }
}
