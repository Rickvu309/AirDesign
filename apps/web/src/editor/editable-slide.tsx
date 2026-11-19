import { boxPatch, format, type ElementId, type StackMove } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { SlideCanvas, type Moved, type Selection } from "@airdesign/render"
import type { ReactNode } from "react"
import { ArrangeMenu } from "@/editor/arrange-menu"
import { commitPlace } from "@/editor/group-actions"
import { commitBoxes, commitEdit, flushPending, type CommitOutcome } from "@/commit-edit"
import { slideListCopy } from "@/copy/slide-list-copy"
import { changeDesign, endChange, type DesignDeck } from "@/design/design-change"
import { valueFits } from "@/design/trait-edit"
import { deviceRegister } from "@/device-copy"
import { slideFrame } from "@/editor/revenue-slide"
import type { ElementChange } from "@/element-edit"
import { landedBox, paintedBox, shownBox } from "@/element-move"
import { storedBox } from "@/frame-boxes"
import { cn } from "@/lib/class-names"
import { showText, shownValue } from "@/live-repaint"
import { shownTable } from "@/table-hook"
import type { UndoName } from "@/copy/undo-copy"
import { boxName } from "@/undo-names"

export type EditableDeck = DesignDeck & {
  readonly changeElement: (change: ElementChange) => Promise<CommitOutcome | "closed">
  readonly selection: Selection
  readonly select: (selection: Selection) => void
}

export function editableSlide(deck: EditableDeck): (width: number) => ReactNode {
  const { id, settle, setPending, changeElement, selection, select } = deck
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
        setPending(true)
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
    setPending(true)
    await deck.shown.showEdited(current)
    settle(await flushPending(connect, id))
  }

  async function placed(only: Moved): Promise<boolean> {
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) return false
    const parts = deck.shown.shownParts.current
    const outcome = await commitPlace(id, parts, opened.register, only.id, only.box, async (undoable) => {
      if (undoable !== null) record({ name: "move", undoable })
      setPending(true)
      await deck.shown.showEdited(current)
    })
    if (outcome === "moved") return false
    if (outcome === "kept") store.current.placeBox(only.id, landedBox(await deviceRegister(id), only.id))
    else settle(outcome)
    return true
  }

  async function onBoxes(moved: readonly Moved[]) {
    const [only] = moved
    if (moved.length === 1 && only !== undefined && (await placed(only))) return
    const opening = connect(memoryRemote()).openDeck(id)
    async function refused(target: ElementId) {
      store.current.placeBox(target, landedBox(await deviceRegister(id), target))
    }
    const framing = deck.shown.shownRegister.current
    const boxes = moved.flatMap(({ id: target, box }) => {
      const element = movables.current.get(target)
      return element === undefined ? [] : [{ box: storedBox(framing, target, box), element }]
    })
    for (const { id: target } of moved) if (!movables.current.has(target)) await refused(target)
    const outcome = await commitBoxes(
      connect,
      id,
      boxes,
      async (kept) => {
        const opened = await opening
        setPending(true)
        const steps = boxes.flatMap(({ box, element }) => {
          const target = element.id
          if (!kept.includes(target)) return []
          const file = shapes.current.get(target)?.box ?? paintedBox(canvases.current(current), target)
          const shown = shownBox(opened.ok ? opened.register : null, target, file)
          const before = shown === null ? null : storedBox(framing, target, shown)
          if (bound.current.has(target) || (before !== null && (before.cx !== box.cx || before.cy !== box.cy)))
            void deck.shown.showEdited(current)
          const name = before === null ? null : boxName(before, box)
          return before === null || name === null
            ? []
            : [{ name, step: { node: target, before: boxPatch(before), after: boxPatch(box) } }]
        })
        const [first] = steps
        if (first === undefined) return
        record({
          name: steps.length > 1 ? "move" : first.name,
          undoable: { steps: steps.map((each) => each.step) },
        })
      },
      refused,
    )
    settle(outcome)
  }

  function holding<T>(targets: readonly ElementId[], work: () => Promise<T>): Promise<T> {
    const releases = targets.map((target) => busy.current.hold(target))
    return work().finally(() => {
      for (const release of releases) release()
    })
  }

  function orderElement(node: ElementId, move: StackMove) {
    return changeElement({ change: "order", node, move })
  }

  return (width) => {
    const canvas = canvases.current(current)
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
      >
        {({ notice, order, group, clear }) => (
          <SlideCanvas
            className="overflow-clip rounded-[2px] focus-within:overflow-visible"
            entering={entering}
            formatting={formatting.current}
            notice={notice}
            onBoxes={(moved) => {
              clear()
              void holding(
                moved.map((each) => each.id),
                () => onBoxes(moved),
              )
            }}
            onOrder={order}
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
}
