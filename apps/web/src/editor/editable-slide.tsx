import { format, type ElementId, type Register, type SetChange, type StackMove } from "@airdesign/document"
import { connect, memoryRemote, noteBoxes } from "@airdesign/live"
import {
  boxOf,
  SlideCanvas,
  type Copied,
  type FlippedLayer,
  type LayerClipboard,
  type LayerPaste,
  type Moved,
  type Selection,
  type Turned,
} from "@airdesign/render"
import type { ReactNode } from "react"
import { ArrangeMenu } from "@/editor/arrange-menu"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { commitPlace } from "@/editor/group-actions"
import { commitEdit, cornersPatch, flushPending, storeBoxes, type BoxCommit, type CommitOutcome } from "@/commit-edit"
import { resizedCorners } from "@/resized-corners"
import { slideListCopy } from "@/copy/slide-list-copy"
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
import { landedBox, paintedBox, shownBox } from "@/element-move"
import { framedOf, storedBox } from "@/frame-boxes"
import { storedGroupBox, storedGroupBoxNow } from "@/group-boxes"
import { MeasuredSlides, owingSlides } from "@/editor/measured-slides"
import { guidedCanvas, type GuidesShown } from "@/editor/slide-guides"
import { indexedRegister } from "@/indexed-register"
import { cn } from "@/lib/class-names"
import { showText, shownValue } from "@/live-repaint"
import { shownTable } from "@/table-hook"
import type { UndoName } from "@/copy/undo-copy"
import { boxName } from "@/undo-names"

export type EditableDeck = DesignDeck & {
  readonly changeElement: (change: ElementChange) => Promise<CommitOutcome | "closed">
  readonly duplicateLayers?: (copies: readonly Moved[]) => Promise<readonly Copied[]>
  readonly pasteLayers?: (copies: readonly CopyAsked[], replacing?: readonly ElementId[]) => Promise<readonly Copied[]>
  readonly pasteFromDeck?: (
    copy: LayerCopy,
    places: readonly PastePlace[],
    replacing?: readonly ElementId[],
  ) => Promise<readonly Copied[]>
  readonly cutLayers?: (nodes: readonly ElementId[]) => Promise<CommitOutcome | "closed">
  readonly selection: Selection
  readonly select: (selection: Selection) => void
  readonly hovered?: ElementId | null
}

const noCut: Promise<"refused"> = Promise.resolve("refused")

const noGuidesShown: GuidesShown = { rulers: false, layoutGuides: true }

export function editableSlide(deck: EditableDeck): (width: number, shown?: GuidesShown) => ReactNode {
  const { id, settle, changeElement, selection, select } = deck
  const { store, boxes, movables, shapes, editParts, canvases, busy, entering, current, slideCount, bound } = deck.shown
  const { typed, sessions, records, formatting, record } = deck.undo

  async function textBefore(target: ElementId): Promise<string> {
    const file = boxes.current.get(target)?.file ?? ""
    const shown = shapes.current.get(target)?.contentKind === "table" ? shownTable : shownValue
    return shown(await deviceRegister(id), target, file)
  }

  function onEdit(target: ElementId, value: string, name: UndoName = "text") {
    const release = records.current.hold()
    return editText(target, value, name, release).finally(release)
  }

  async function editText(
    target: ElementId,
    value: string,
    name: UndoName,
    release: () => void,
  ): Promise<CommitOutcome> {
    if (name !== "text" || typed.current?.node !== target) {
      sessions.current += 1
      typed.current = { node: target, session: sessions.current, before: textBefore(target) }
    }
    const { session, before: started } = typed.current
    if (name !== "text") typed.current = null
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

  async function fitted(node: ElementId, height: number) {
    const floor = boxes.current.get(node)?.file ?? movables.current.get(node)?.file ?? ""
    const row = { v: format, patch: { box: { h: { set: height } } } }
    if (!(await connect(memoryRemote()).enqueueRow(id, row, node, floor)).ok) return
    await deck.shown.showEdited(current)
    const shownRegister = deck.shown.shownRegister.current
    if (shownRegister !== null)
      store.current.placeBox(node, landedBox(indexedRegister(deck.shown.shownParts.current, shownRegister), node))
    settle(await flushPending(connect, id))
  }

  async function placed(only: Moved): Promise<"moved" | "kept" | "refused" | "stored"> {
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) return "moved"
    const parts = deck.shown.shownParts.current
    const outcome = await commitPlace(id, parts, opened.register, only.id, only.box, async (undoable) => {
      if (undoable !== null) record({ name: "move", undoable })
      await deck.shown.showEdited(current)
    })
    if (outcome === "kept") store.current.placeBox(only.id, landedBox(await deviceRegister(id), only.id))
    return outcome
  }

  async function storeMoved(
    moved: readonly Moved[],
    boxes: readonly BoxCommit[],
    framing: Register | null,
  ): Promise<CommitOutcome | "stored" | null> {
    const [only] = moved
    const place = moved.length === 1 && only !== undefined ? await placed(only) : "moved"
    if (place === "kept") return null
    if (place !== "moved") return place
    const opening = connect(memoryRemote()).openDeck(id)
    async function refused(target: ElementId) {
      store.current.placeBox(target, landedBox(await deviceRegister(id), target))
    }
    for (const { id: target } of moved) if (!movables.current.has(target)) await refused(target)
    const stored = await storeBoxes(
      connect,
      id,
      boxes,
      async (kept) => {
        const opened = await opening
        const steps = boxes.flatMap(({ box, element, corners }) => {
          const target = element.id
          if (!kept.includes(target)) return []
          const file = shapes.current.get(target)?.box ?? paintedBox(canvases.current(current), target)
          const shown = shownBox(opened.ok ? opened.register : null, target, file)
          const before =
            storedGroupBoxNow(framing, target) ?? (shown === null ? null : storedBox(framing, target, shown))
          if (bound.current.has(target) || (before !== null && (before.cx !== box.cx || before.cy !== box.cy)))
            void deck.shown.showEdited(current)
          const name = before === null ? null : boxName(before, box)
          return before === null || name === null
            ? []
            : [
                {
                  name,
                  step: {
                    node: target,
                    before: cornersPatch(before, corners?.before),
                    after: cornersPatch(box, corners?.after),
                  },
                },
              ]
        })
        const [first] = steps
        if (first === undefined) return
        const name = steps.length > 1 ? (steps.some((each) => each.name === "resize") ? "resize" : "move") : first.name
        record({
          name,
          undoable: { steps: steps.map((each) => each.step) },
        })
      },
      refused,
    )
    const grouped = moved.filter(({ id: target }) => storedGroupBoxNow(framing, target) !== undefined)
    if (grouped.length > 0) {
      await deck.shown.showEdited(current)
      for (const each of grouped) store.current.placeBox(each.id, null)
    }
    return stored
  }

  async function onBoxes(moved: readonly Moved[]): Promise<void> {
    const shownRegister = deck.shown.shownRegister.current
    const framing = shownRegister === null ? null : indexedRegister(deck.shown.shownParts.current, shownRegister)
    const painted = canvases.current(current)?.elements
    const boxes = moved.flatMap(({ id: target, box }) => {
      const element = movables.current.get(target)
      const stored = storedGroupBox(framing, target, box) ?? storedBox(framing, target, box)
      const corners = resizedCorners(
        painted?.find((each) => each.id === target),
        box,
      )
      return element === undefined ? [] : [{ box: stored, element, ...corners }]
    })
    const release = noteBoxes(
      id,
      boxes.map(({ box, element }) => ({ node: element.id, floor: element.file, box })),
    )
    const stored = await deck.undo.turnAfter(() => storeMoved(moved, boxes, framing)).finally(release)
    if (stored === "stored") settle(await flushPending(connect, id))
    else if (stored !== null) settle(stored)
  }

  function holding<T>(targets: readonly ElementId[], work: () => Promise<T>): Promise<T> {
    const releases = targets.map((target) => busy.current.hold(target))
    return work().finally(() => {
      for (const release of releases) release()
    })
  }

  function angleUnits(degrees: number): number {
    const normalized = ((degrees % 360) + 360) % 360
    return Math.round(normalized * 60_000) % 21_600_000
  }

  function onRotate(turned: readonly Turned[]) {
    const shownRegister = deck.shown.shownRegister.current
    const framing = shownRegister === null ? null : indexedRegister(deck.shown.shownParts.current, shownRegister)
    const changes: readonly SetChange[] = turned.map((each) => {
      const placed = each.box === undefined ? undefined : storedBox(framing, each.id, each.box)
      return {
        target: { node: each.id },
        box: {
          ...(placed === undefined ? {} : { x: placed.x, y: placed.y }),
          rot: angleUnits(each.rotation),
        },
      }
    })
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
    const shownRegister = deck.shown.shownRegister.current
    const framing = shownRegister === null ? null : indexedRegister(deck.shown.shownParts.current, shownRegister)
    const changes: readonly SetChange[] = flipped.map((each) => {
      const placed = each.box === undefined ? undefined : storedBox(framing, each.id, each.box)
      return {
        target: { node: each.id },
        box: {
          ...(placed === undefined ? {} : { x: placed.x, y: placed.y }),
          ...(each.rotation === undefined ? {} : { rot: angleUnits(each.rotation) }),
          ...(each.flipH === undefined ? {} : { flipH: each.flipH }),
          ...(each.flipV === undefined ? {} : { flipV: each.flipV }),
        },
      }
    })
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
              toast.error(elementCopy.clipRefusedTitle, {
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
            return copy === null ? null : pasted(copy, paste)
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
        onFit={(node, height) => void fitted(node, height)}
      />
    )
  }

  function slideAt(width: number, shown: GuidesShown) {
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
            selection={selection}
            onSelection={select}
            onConnect={(node, end, to) => {
              clear()
              changeDesign(deck, () => endChange(node, end, to))
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
            onFit={(node, height) => void fitted(node, height)}
            onEdit={(target, value, kind) => {
              clear()
              void holding([target], () => onEdit(target, value, kind))
            }}
            slide={canvas}
            slideName={slideCount > 0 ? slideListCopy.slideName(current + 1, slideCount) : undefined}
            store={store.current}
            width={width}
          />
        )}
      </ArrangeMenu>
    )
  }

  return (width, shown = noGuidesShown) => (
    <>
      {slideAt(width, shown)}
      {measured(width)}
    </>
  )
}
