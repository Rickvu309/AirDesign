import {
  type ChartKind,
  type ElementId,
  type Geometry,
  type Media,
  type Register,
  type Undoable,
} from "@airdesign/document"
import { connect, flushMedia, keepMedia, memoryRemote } from "@airdesign/live"
import { holdKeys, type CanvasSlide, type Copied, type HeldKeys, type Moved, type ShapeDrawn } from "@airdesign/render"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { toast } from "@/components/ui/toast"
import { bytesOf64, type CopiedLayer, type LayerCopy } from "@/layer-clipboard"
import { pastedAdds, type PastePlace } from "@/layer-paste"
import { fileSlides } from "@/slide-edit"
import type { UndoName } from "@/copy/undo-copy"
import type { StoreLane } from "@/editor/store-lane"
import type { DeckPaint } from "@/editor/use-deck-paint"
import { elementCopy } from "@/copy/element-copy"
import {
  commitCopies,
  copyPlan,
  planElement,
  storePlan,
  type ElementPlan,
  replacedUndoable,
  type CopyAsked,
  type ElementChange,
  type TextPlace,
} from "@/element-edit"
import { commitPicture, iconPlan, type PictureFile } from "@/picture-add"
import type { PictureStore } from "@/picture-tool"
import type { RecordHold, UndoEntry } from "@/undo-list"
import { elementNames, stackNames } from "@/undo-names"
import { placedOn, placingText } from "@/editor/placed-text"

import { addSlideNumbers } from "./slide-number-actions"

export type InsertingDeck = {
  readonly id: string
  readonly shown: DeckPaint
  readonly lane: StoreLane
  readonly pictureTool: { readonly store: PictureStore }
  readonly hold: () => RecordHold
  readonly settle: (outcome: CommitOutcome) => void
}

export function deckInserts(deck: InsertingDeck) {
  const { id, pictureTool, settle, lane } = deck
  const { shownParts, canvases, current, setEntering, showEdited, store } = deck.shown
  const placedText = placingText(
    {
      id,
      held: deck.shown.placed,
      parts: () => shownParts.current,
      room: () => roomAt(current),
      index: () => current,
      painted: () => painted(),
      show: () => deck.shown.showRegister(deck.shown.shownRegister.current),
      showSaved: () => showEdited("kept"),
      enter: (node, keys) => setEntering({ id: node, keys }),
      hold: deck.hold,
      lane,
    },
    connect(memoryRemote()),
  )

  async function openPlaced(): Promise<Register | null> {
    const opened = await connect(memoryRemote()).openDeck(id)
    return opened.ok ? placedOn(opened.register, deck.shown.placed.current) : null
  }

  function roomAt(index: number): CanvasSlide | null {
    const room = canvases.current(index)
    if (room === null) return null
    const elements = room.elements.map((element) => {
      const resting = element.id === null ? null : store.current.getRestingBox(element.id)
      return resting === null || element.box === null
        ? element
        : { ...element, box: { ...element.box, x: resting.x, y: resting.y, width: resting.cx, height: resting.cy } }
    })
    return { ...room, elements }
  }

  function recordAdded(name: UndoName, slot: RecordHold, stored: () => void, selects = false) {
    return async (added: ElementId | null, undoable: Undoable | null) => {
      stored()
      if (undoable !== null) slot.record({ name, undoable })
      enterAdded(added, undefined, selects)
      await showEdited("kept")
    }
  }

  function heldLane<Result>(change: (stored: () => void, slot: RecordHold) => Promise<Result>): Promise<Result> {
    const slot = deck.hold()
    return lane((stored) => change(stored, slot)).finally(slot.release)
  }

  function painted(): Register | null {
    const register = deck.shown.shownRegister.current
    return register === null ? null : placedOn(register, deck.shown.placed.current)
  }

  function enterAdded(added: ElementId | null, keys?: HeldKeys, selects = false) {
    const held = keys === undefined ? {} : { keys }
    setEntering(added === null ? null : { id: added, ...held, ...(selects ? { selects: true as const } : {}) })
  }

  function storeAhead(plan: ElementPlan, entry: (undoable: Undoable) => UndoEntry): Promise<"stored" | "refused"> {
    const written = deck.shown.ahead.paint(plan.commands)
    const slot = deck.hold()
    return lane(async (stored) => {
      try {
        const went = await storePlan(id, plan)
        written()
        stored()
        const undoable = went === null ? null : plan.undo(went)
        if (undoable !== null) slot.record(entry(undoable))
        slot.release()
        await showEdited("kept")
        return went === null ? "refused" : "stored"
      } finally {
        written()
        slot.release()
      }
    })
  }

  async function flushed(outcome: "stored" | "refused"): Promise<CommitOutcome> {
    const settled = outcome === "stored" ? await flushPending(connect, id) : "refused"
    settle(settled)
    return settled
  }

  function changeElement(change: ElementChange, named?: UndoName): Promise<CommitOutcome | "closed"> {
    const typed = change.change === "text" || change.change === "shape"
    const keys = typed ? holdKeys(document) : undefined
    const name =
      named ??
      (change.change !== "order"
        ? elementNames[change.change]
        : typeof change.move === "string"
          ? stackNames[change.move]
          : "layer-order")
    const absorbs = change.change === "remove" && change.emptied === true ? { absorbs: change.nodes[0] } : {}
    const register = painted()
    const plan = register === null ? null : planElement(shownParts.current, register, change)
    if (plan === null) {
      keys?.stop()
      settle("refused")
      return Promise.resolve("refused")
    }
    const storing = storeAhead(plan, (undoable) => ({ name, undoable, ...absorbs }))
    enterAdded(plan.added, keys, change.change === "shape")
    return storing.then((outcome) => {
      if (outcome === "refused") keys?.stop()
      return flushed(outcome)
    })
  }

  function copyLayers(
    copies: readonly CopyAsked[],
    name: UndoName,
    title?: string,
    replacing: readonly ElementId[] = [],
  ): Promise<readonly Copied[]> {
    const register = painted()
    if (replacing.length === 0 && register !== null) {
      const made = copyPlan(shownParts.current, register, copies, title)
      if (made === null) return Promise.resolve([])
      void storeAhead(made.plan, (undoable) => ({ name, undoable })).then(flushed)
      return Promise.resolve(made.copies)
    }
    return heldLane(async (stored, slot) => {
      const register = await openPlaced()
      if (register === null) return []
      const paint = async (undoable: Undoable | null) => {
        stored()
        if (undoable !== null) slot.record({ name, undoable })
        await showEdited("kept")
      }
      const made = await commitCopies(id, shownParts.current, register, copies, paint, title, replacing)
      void made.flushed.then(settle)
      return made.copies
    })
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

  function pasteFromDeck(
    copy: LayerCopy,
    places: readonly PastePlace[],
    replacing: readonly ElementId[] = [],
  ): Promise<readonly Copied[]> {
    return heldLane(async (stored, slot) => {
      const register = await openPlaced()
      if (register === null) return []
      const media: (readonly Media[])[] = []
      for (const layer of copy.layers) media.push((await keptImages(layer)) ?? [])
      const { edits, refused } = pastedAdds(shownParts.current, register, copy, places, media)
      for (const refusal of refused)
        toast.refusal(elementCopy.pasteRefusedTitle, {
          id: `paste-refused-${refusal}`,
          description: elementCopy.pasteElsewhereBody[refusal],
        })
      const file = fileSlides(shownParts.current, register)
      const went = []
      for (const edit of edits) if ((await connect(memoryRemote()).enqueueSlide(id, file, edit)).ok) went.push(edit)
      stored()
      if (went.length === 0) return []
      const undoable = await replacedUndoable(id, shownParts.current, register, went, replacing)
      if (undoable !== null) slot.record({ name: replacing.length === 0 ? "paste-layer" : "replace-layer", undoable })
      await showEdited("kept")
      void flushMedia(id).then(() => flushPending(connect, id).then(settle))
      return edits.map((edit) => ({ copy: edit.element.node, source: edit.element.node }))
    })
  }

  function cutLayers(nodes: readonly ElementId[]) {
    return changeElement({ change: "remove", nodes }, "cut-layer")
  }

  function addText(place?: TextPlace) {
    if (place !== undefined) {
      placedText.place(place, holdKeys(document))
      return
    }
    const size = roomAt(current)
    if (size !== null) void changeElement({ change: "text", index: current, size })
  }

  function addChart(kind: ChartKind) {
    const room = roomAt(current)
    if (room !== null) void changeElement({ change: "chart", kind, index: current, size: room })
  }

  function addShape(geometry: Geometry, drawn?: ShapeDrawn) {
    const size = roomAt(current)
    if (size !== null)
      void changeElement({ change: "shape", geometry, index: current, size, ...(drawn === undefined ? {} : { drawn }) })
  }

  async function addPicture(picture: PictureFile) {
    const slide = roomAt(current)
    if (slide === null) return
    const at = { index: current, slide, keep: pictureTool.store.keep }
    settle(
      await heldLane(async (stored, slot) => {
        const register = await openPlaced()
        if (register === null) return "refused"
        return commitPicture(id, shownParts.current, register, picture, at, recordAdded("add-picture", slot, stored))
      }),
    )
  }

  async function addIcon(name: string) {
    const slide = roomAt(current)
    if (slide === null) return
    const at = { index: current, slide, keep: pictureTool.store.keep }
    const plan = await iconPlan(shownParts.current, painted, name, at)
    if (plan === null) {
      settle("refused")
      return
    }
    const storing = storeAhead(plan, (undoable) => ({ name: "add-icon", undoable }))
    enterAdded(plan.added)
    await flushed(await storing)
  }

  return {
    changeElement,
    duplicateLayers,
    pasteLayers,
    pasteFromDeck,
    cutLayers,
    addText,
    placedText,
    addChart,
    addShape,
    addPicture,
    addIcon,
    addSlideNumber: () => void addSlideNumbers(deck),
  }
}
