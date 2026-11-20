import { format, type CellTexts, type ElementId, type Register, type StackMove } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import {
  boxOf,
  manyCells,
  readPastedCells,
  SlideCanvas,
  type Copied,
  type FitSize,
  type FlippedLayer,
  type LayerClipboard,
  type LayerPaste,
  type Moved,
  type Selection,
  type ShapeDrawing,
  type TextPlace,
  type Turned,
} from "@airdesign/render"
import type { ReactNode } from "react"
import { ArrangeMenu } from "@/editor/arrange-menu"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { boxMoves } from "@/editor/box-moves"
import { commitEdit, flushPending, type CommitOutcome } from "@/commit-edit"
import { latestFit } from "@/editor/latest-fit"
import { leftEmptied } from "@/editor/emptied-text"
import { slideListCopy } from "@/copy/slide-list-copy"
import { canvasCropChange } from "@/design/crop-change"
import { flipChanges, turnChanges } from "@/editor/turn-changes"
import { changeDesign, endChange, type DesignDeck } from "@/design/design-change"
import { toggleLayerFlag } from "@/editor/layer-flags"
import { valueFits } from "@/design/trait-edit"
import { deviceRegister } from "@/device-copy"
import { slideFrame } from "@/editor/revenue-slide"
import { toast } from "@/components/ui/toast"
import { elementCopy } from "@/copy/element-copy"
import type { CopyAsked, ElementChange } from "@/element-edit"
import { readClipboardCopy, readLayerCopy, writeLayerCopy, type LayerCopy } from "@/layer-clipboard"
import { layerCopyOf, pastedCopies, slideIdAt, type PastePlace } from "@/layer-paste"
import { layersPng } from "@/layers-png"
import { landedBox } from "@/element-move"
import { framedOf } from "@/frame-boxes"
import { MeasuredSlides, owingSlides } from "@/editor/measured-slides"
import { guidedCanvas, type GuidesShown } from "@/editor/slide-guides"
import { indexedRegister } from "@/indexed-register"
import { cn } from "@/lib/class-names"
import { showText, shownValue } from "@/live-repaint"
import { shownTable } from "@/table-hook"
import { tableCanvas, type TableCanvasDeck } from "@/editor/table-canvas"
import type { UndoName } from "@/copy/undo-copy"
import type { Typing } from "@/undo-list"

export type EditableDeck = DesignDeck &
  TableCanvasDeck & {
    readonly changeElement: (change: ElementChange) => Promise<CommitOutcome | "closed">
    readonly duplicateLayers?: (copies: readonly Moved[]) => Promise<readonly Copied[]>
    readonly pasteLayers?: (
      copies: readonly CopyAsked[],
      replacing?: readonly ElementId[],
    ) => Promise<readonly Copied[]>
    readonly pasteFromDeck?: (
      copy: LayerCopy,
      places: readonly PastePlace[],
      replacing?: readonly ElementId[],
    ) => Promise<readonly Copied[]>
    readonly cutLayers?: (nodes: readonly ElementId[]) => Promise<CommitOutcome | "closed">
    readonly pasteTable?: (cells: CellTexts) => void
    readonly selection: Selection
    readonly select: (selection: Selection) => void
    readonly hovered?: ElementId | null
    readonly placedText?: PlacedTextActions
  }

type PlacedTextActions = {
  readonly typed: (node: ElementId, value: string) => Promise<boolean>
  readonly stored: (node: ElementId) => Promise<boolean>
  readonly left: (node: ElementId) => boolean
}

const noCut: Promise<"refused"> = Promise.resolve("refused")

const togetherSessions = new WeakMap<object, number>()

const noGuidesShown: GuidesShown = { rulers: false, layoutGuides: true }

export function editableSlide(
  deck: EditableDeck,
): (
  width: number,
  shown?: GuidesShown,
  onPlaceText?: (place: TextPlace) => void,
  drawShape?: ShapeDrawing,
) => ReactNode {
  const { id, settle, changeElement, selection, select } = deck
  const { store, boxes, movables, shapes, editParts, canvases, busy, entering, current, slideCount } = deck.shown
  const { onBoxes, relayout } = boxMoves(deck)
  const { cropping, setCropping } = deck.shown
  const { typed, sessions, records, formatting, record } = deck.undo

  async function textBefore(target: ElementId): Promise<string> {
    const file = boxes.current.get(target)?.file ?? ""
    const shown = shapes.current.get(target)?.contentKind === "table" ? shownTable : shownValue
    return shown(await deviceRegister(id), target, file)
  }

  function onEdit(target: ElementId, value: string, name: UndoName = "text") {
    const release = records.current.hold()
    const together = formatting.current.together()
    const placed = deck.placedText?.typed(target, value) ?? Promise.resolve(true)
    return placed
      .then((stored): Promise<CommitOutcome> | "empty" =>
        stored ? editText(target, value, name, release, together) : "empty",
      )
      .finally(release)
  }

  function sessionOf(target: ElementId, name: UndoName, together: object | null): Typing {
    if (together !== null) {
      typed.current = null
      const shared = togetherSessions.get(together) ?? (sessions.current += 1)
      togetherSessions.set(together, shared)
      return { node: target, session: shared, before: textBefore(target) }
    }
    if (name !== "text" || typed.current?.node !== target) {
      sessions.current += 1
      typed.current = { node: target, session: sessions.current, before: textBefore(target) }
    }
    const opened = typed.current
    if (name !== "text") typed.current = null
    return opened
  }

  async function editText(
    target: ElementId,
    value: string,
    name: UndoName,
    release: () => void,
    together: object | null = null,
  ): Promise<CommitOutcome> {
    const { session, before: started } = sessionOf(target, name, together)
    const box = boxes.current.get(target)
    if (box === undefined) return "refused"
    const file = box.file
    async function refused() {
      showText(store.current, target, shownValue(await deviceRegister(id), target, file))
    }
    const shape = shapes.current.get(target)
    if (shape === undefined || !valueFits(editParts.current, shape, value)) {
      await refused()
      return "refused"
    }
    showText(store.current, target, value)
    const outcome = await commitEdit(
      connect,
      id,
      value,
      box,
      async () => {
        const before = await started
        const holder = shape?.contentKind === "table" ? "table" : "text"
        record({
          name,
          session,
          undoable: {
            steps: [
              {
                node: target,
                before: { [holder]: { value: { set: before } } },
                after: { [holder]: { value: { set: value } } },
              },
            ],
          },
        })
        release()
      },
      refused,
    )
    settle(outcome)
    return outcome
  }

  const leaveEmptied = leftEmptied({
    typedIn: (node) => typed.current?.node === node,
    landed: () => records.current.landed(),
    saved: async () => {
      const register = await deviceRegister(id)
      return register === null ? null : indexedRegister(deck.shown.shownParts.current, register)
    },
    remove: (node) => holding([node], () => changeElement({ change: "remove", nodes: [node], emptied: true })),
  })

  function leftText(node: ElementId) {
    if (deck.placedText?.left(node) !== true) void leaveEmptied(node)
  }

  async function fitted(node: ElementId, size: FitSize) {
    if (!(await (deck.placedText?.stored(node) ?? true))) return
    const floor = boxes.current.get(node)?.file ?? movables.current.get(node)?.file ?? ""
    const width = size.width === undefined ? {} : { w: { set: size.width } }
    const row = { v: format, patch: { box: { ...width, h: { set: size.height } } } }
    const latest = latestFit(store.current, node)
    if (!(await connect(memoryRemote()).enqueueRow(id, row, node, floor)).ok) return
    await deck.shown.showEdited("kept")
    const shownRegister = deck.shown.shownRegister.current
    if (shownRegister !== null && latest())
      store.current.placeBox(node, landedBox(indexedRegister(deck.shown.shownParts.current, shownRegister), node))
    settle(await flushPending(connect, id))
  }

  function holding<T>(targets: readonly ElementId[], work: () => Promise<T>): Promise<T> {
    const releases = targets.map((target) => busy.current.hold(target))
    return work().finally(() => {
      for (const release of releases) release()
    })
  }

  function framingNow(): Register | null {
    const shownRegister = deck.shown.shownRegister.current
    return shownRegister === null ? null : indexedRegister(deck.shown.shownParts.current, shownRegister)
  }

  function onRotate(turned: readonly Turned[]) {
    const changes = turnChanges(framingNow(), turned)
    const clearLive = async () => {
      const currentRegister = await deviceRegister(id)
      for (const each of turned) {
        store.current.placeRotation(each.id, null)
        if (each.box !== undefined) store.current.placeBox(each.id, landedBox(currentRegister, each.id))
      }
    }
    changeDesign(
      deck,
      () => changes,
      undefined,
      () => void clearLive(),
    )
  }

  function onFlip(flipped: readonly FlippedLayer[]) {
    const changes = flipChanges(framingNow(), flipped)
    changeDesign(deck, () => changes)
  }

  function orderElement(node: ElementId, move: StackMove) {
    return changeElement({ change: "order", node, move })
  }

  function shownBoxes(ids: readonly ElementId[]): readonly Moved[] {
    const canvas = canvases.current(current)
    return ids.flatMap((target) => {
      const painted = canvas?.elements.find((each) => each.id === target)?.box ?? null
      const box = store.current.getBox(target) ?? (painted === null ? null : boxOf(painted))
      return box === null ? [] : [{ id: target, box }]
    })
  }

  function pasted(copy: LayerCopy | null, paste: LayerPaste): Promise<readonly Copied[]> {
    const { pasteLayers } = deck
    const register = deck.shown.shownRegister.current
    const canvas = canvases.current(current)
    if (copy === null || pasteLayers === undefined || register === null || canvas === null) return Promise.resolve([])
    const onto = slideIdAt(deck.shown.shownParts.current, register, current)
    if (onto === null) return Promise.resolve([])
    const shown = shownBoxes(paste.selection)
    const replacing = paste.mode === "replace" ? shown.map((each) => each.id) : []
    if (paste.mode === "replace" && replacing.length === 0) return Promise.resolve([])
    const groups = paste.mode === "replace" ? shown.map((each) => [each.box]) : [shown.map((each) => each.box)]
    const mode = paste.mode === "replace" ? "over" : paste.mode
    const places = groups.map((selected) => ({ mode, onto, slide: canvas, view: paste.view, selected }))
    if (copy.deck !== id) return deck.pasteFromDeck?.(copy, places, replacing) ?? Promise.resolve([])
    return pasteLayers(
      places.flatMap((place) => pastedCopies(copy, place)),
      replacing,
    )
  }

  const clipboard: LayerClipboard | undefined =
    deck.pasteLayers === undefined
      ? undefined
      : {
          copy(ids, data, cut) {
            const register = deck.shown.shownRegister.current
            if (register === null) return false
            const { shownParts, displayParts } = deck.shown
            const made = layerCopyOf(id, shownParts.current, displayParts.current, register, shownBoxes(ids))
            for (const refusal of made.refused)
              toast.refusal(elementCopy.clipRefusedTitle, {
                id: `clip-refused-${refusal}`,
                description: elementCopy.copyRefusedBody[refusal],
              })
            const copy = made.copy
            if (copy === null || copy.layers.length === 0) return false
            writeLayerCopy(copy, data)
            const sources = copy.layers.map((layer) => layer.source)
            if (cut && deck.cutLayers !== undefined) void holding(sources, () => deck.cutLayers?.(sources) ?? noCut)
            return true
          },
          picture: (ids) => layersPng(deck.shown.displayParts.current, current, ids),
          paste(paste) {
            if (paste.data === null) return readClipboardCopy().then((copy) => pasted(copy, paste))
            const copy = readLayerCopy(paste.data.getData("text/html"))
            if (copy !== null) return pasted(copy, paste)
            const cells = paste.mode === "paste" ? readPastedCells(paste.data) : null
            if (!manyCells(cells) || deck.pasteTable === undefined) return null
            deck.pasteTable(cells)
            return Promise.resolve([])
          },
        }

  function measured(width: number) {
    const shownRegister = deck.shown.shownRegister.current
    const owed = framedOf(
      shownRegister === null ? null : indexedRegister(deck.shown.shownParts.current, shownRegister),
    ).owed
    return (
      <MeasuredSlides
        slides={owingSlides(store.current, owed, current)}
        canvases={canvases.current}
        store={store.current}
        width={width}
        onFit={(node, size) => void fitted(node, size)}
      />
    )
  }

  function slideAt(
    width: number,
    shown: GuidesShown,
    onPlaceText: ((place: TextPlace) => void) | undefined,
    drawShape: ShapeDrawing | undefined,
  ) {
    const painted = canvases.current(current)
    const canvas = painted === null ? null : guidedCanvas(painted, deck.shown.displayParts.current, current, shown)
    return canvas === null ? (
      <div />
    ) : (
      <ArrangeMenu
        className={cn(slideFrame, "block shrink-0")}
        parts={editParts.current}
        slide={canvas}
        selection={selection}
        onOrder={orderElement}
        onGroup={changeElement}
        onMask={(node) => toggleLayerFlag(deck, [node], "mask")}
      >
        {({ notice, order, group, clear }) => (
          <SlideCanvas
            className="overflow-clip rounded-[2px] focus-within:overflow-visible"
            entering={entering}
            formatting={formatting.current}
            {...(deck.hovered === undefined || deck.hovered === null ? {} : { highlights: [deck.hovered] })}
            notice={notice}
            onBoxes={(moved) => {
              clear()
              void holding(
                moved.map((each) => each.id),
                () => onBoxes(moved),
              )
            }}
            onRotate={(turned) => {
              clear()
              onRotate(turned)
            }}
            onRelayout={relayout}
            onFlip={(flipped) => {
              clear()
              onFlip(flipped)
            }}
            {...(deck.duplicateLayers === undefined
              ? {}
              : {
                  onDuplicate: (copies: readonly Moved[]) => {
                    clear()
                    return deck.duplicateLayers?.(copies) ?? Promise.resolve([])
                  },
                })}
            onOrder={order}
            ownsKey={editorOwnsKey}
            {...(clipboard === undefined ? {} : { clipboard })}
            {...(onPlaceText === undefined ? {} : { onPlaceText })}
            {...(drawShape === undefined ? {} : { drawShape })}
            onLeaveText={leftText}
            selection={selection}
            onSelection={select}
            onConnect={(node, end, to) => {
              clear()
              changeDesign(deck, () => endChange(node, end, to))
            }}
            cropping={cropping}
            onCropping={setCropping}
            onCrop={(node, cropped) => {
              clear()
              changeDesign(deck, () => canvasCropChange(node, cropped))
            }}
            onGroup={(nodes) => {
              clear()
              group({ change: "group", nodes })
            }}
            onUngroup={(node) => {
              clear()
              group({ change: "ungroup", node })
            }}
            onFrame={(nodes) => {
              clear()
              group({ change: "frame", nodes })
            }}
            onPlainFrame={(nodes) => {
              clear()
              group({ change: "plain-frame", nodes })
            }}
            onRemove={(targets) => {
              clear()
              void holding(targets, () => changeElement({ change: "remove", nodes: targets }))
            }}
            onFit={(node, size) => void fitted(node, size)}
            onEdit={(target, value, kind) => {
              clear()
              void holding([target], () => onEdit(target, value, kind))
            }}
            {...tableCanvas(deck, (target, value, name) => holding([target], () => onEdit(target, value, name)))}
            slide={canvas}
            slideName={slideCount > 0 ? slideListCopy.slideName(current + 1, slideCount) : undefined}
            store={store.current}
            width={width}
          />
        )}
      </ArrangeMenu>
    )
  }

  return (width, shown = noGuidesShown, onPlaceText, drawShape) => (
    <>
      {slideAt(width, shown, onPlaceText, drawShape)}
      {measured(width)}
    </>
  )
}
