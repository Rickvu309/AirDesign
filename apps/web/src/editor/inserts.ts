import { type ChartKind, type ElementId, type Geometry, type Media, type Undoable } from "@airdesign/document"
import { connect, flushMedia, keepMedia, memoryRemote } from "@airdesign/live"
import { holdKeys, type Copied, type HeldKeys, type Moved } from "@airdesign/render"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { toast } from "@/components/ui/toast"
import { bytesOf64, type CopiedLayer, type LayerCopy } from "@/layer-clipboard"
import { pastedAdds, type PastePlace } from "@/layer-paste"
import { fileSlides } from "@/slide-edit"
import type { UndoName } from "@/copy/undo-copy"
import type { DeckPaint } from "@/editor/use-deck-paint"
import { elementCopy } from "@/copy/element-copy"
import {
  commitCopies,
  commitElement,
  replacedUndoable,
  type CopyAsked,
  type ElementChange,
  type TableSize,
} from "@/element-edit"
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

  async function copyLayers(
    copies: readonly CopyAsked[],
    name: UndoName,
    title?: string,
    replacing: readonly ElementId[] = [],
  ): Promise<readonly Copied[]> {
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) return []
    const paint = async (undoable: Undoable | null) => {
      if (undoable !== null) record({ name, undoable })
      await showEdited(current)
    }
    const made = await commitCopies(id, shownParts.current, opened.register, copies, paint, title, replacing)
    void made.flushed.then(settle)
    return made.copies
  }

  function duplicateLayers(copies: readonly Moved[]): Promise<readonly Copied[]> {
    return copyLayers(copies, "duplicate-layer")
  }

  function pasteLayers(copies: readonly CopyAsked[], replacing: readonly ElementId[] = []): Promise<readonly Copied[]> {
    const name = replacing.length === 0 ? "paste-layer" : "replace-layer"
    return copyLayers(copies, name, elementCopy.pasteRefusedTitle, replacing)
  }

  async function keptImages(layer: CopiedLayer): Promise<readonly Media[] | null> {
    const kept: Media[] = []
    for (const image of layer.carried?.images ?? []) {
      const bytes = bytesOf64(image.data)
      if (bytes === null) return null
      const sha256 = await keepMedia(id, bytes)
      pictureTool.store.keep(sha256, bytes)
      kept.push({ sha256, type: image.type })
    }
    return kept
  }

  async function pasteFromDeck(
    copy: LayerCopy,
    places: readonly PastePlace[],
    replacing: readonly ElementId[] = [],
  ): Promise<readonly Copied[]> {
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) return []
    const media: (readonly Media[])[] = []
    for (const layer of copy.layers) media.push((await keptImages(layer)) ?? [])
    const { edits, refused } = pastedAdds(shownParts.current, opened.register, copy, places, media)
    for (const refusal of refused)
      toast.refusal(elementCopy.pasteRefusedTitle, {
        id: `paste-refused-${refusal}`,
        description: elementCopy.pasteElsewhereBody[refusal],
      })
    const file = fileSlides(shownParts.current, opened.register)
    const went = []
    for (const edit of edits) if ((await connect(memoryRemote()).enqueueSlide(id, file, edit)).ok) went.push(edit)
    if (went.length === 0) return []
    const undoable = await replacedUndoable(id, shownParts.current, opened.register, went, replacing)
    if (undoable !== null) record({ name: replacing.length === 0 ? "paste-layer" : "replace-layer", undoable })
    await showEdited(current)
    void flushMedia(id).then(() => flushPending(connect, id).then(settle))
    return edits.map((edit) => ({ copy: edit.element.node, source: edit.element.node }))
  }

  function cutLayers(nodes: readonly ElementId[]) {
    return changeElement({ change: "remove", nodes }, "cut-layer")
  }

  function addText() {
    const size = canvases.current(current)
    if (size !== null) void changeElement({ change: "text", index: current, size })
  }

  function addTable(size: TableSize) {
    const room = canvases.current(current)
    if (room !== null) void changeElement({ change: "table", index: current, size: room, ...size })
  }

  function addChart(kind: ChartKind) {
    const room = canvases.current(current)
    if (room !== null) void changeElement({ change: "chart", kind, index: current, size: room })
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
    pasteFromDeck,
    cutLayers,
    addText,
    addTable,
    addChart,
    addShape,
    addPicture,
    addIcon,
    addSlideNumber: () => void addSlideNumbers(deck),
  }
}
