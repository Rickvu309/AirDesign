import { boxPatch, type Box, type ElementId, type StackMove } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { SlideCanvas } from "@airdesign/render"
import type { ReactNode } from "react"
import { ArrangeMenu } from "@/editor/arrange-menu"
import { commitBox, commitEdit, type CommitOutcome } from "@/commit-edit"
import { slideListCopy } from "@/copy/slide-list-copy"
import { changeDesign, endChange, type DesignDeck } from "@/design/design-change"
import { valueFits } from "@/design/trait-edit"
import { deviceRegister } from "@/device-copy"
import { slideFrame } from "@/editor/revenue-slide"
import type { ElementChange } from "@/element-edit"
import { landedBox, paintedBox, shownBox } from "@/element-move"
import { cn } from "@/lib/class-names"
import { showText, shownValue } from "@/live-repaint"
import { shownTable, type useTables } from "@/table-hook"
import type { UndoName } from "@/copy/undo-copy"
import { boxName } from "@/undo-names"

export type EditableDeck = DesignDeck & {
  readonly tables: ReturnType<typeof useTables>
  readonly changeElement: (change: ElementChange) => Promise<CommitOutcome | "closed">
  readonly select: (id: ElementId | null) => void
}

export function editableSlide(deck: EditableDeck): (width: number) => ReactNode {
  const { id, tables, settle, setPending, changeElement, select } = deck
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

  async function onBox(target: ElementId, box: Box) {
    async function refused() {
      store.current.placeBox(target, landedBox(await deviceRegister(id), target))
    }
    const element = movables.current.get(target)
    if (element === undefined) {
      await refused()
      return
    }
    const opening = connect(memoryRemote()).openDeck(id)
    const file = shapes.current.get(target)?.box ?? paintedBox(canvases.current(current), target)
    const outcome = await commitBox(
      connect,
      id,
      box,
      element,
      async () => {
        const opened = await opening
        const before = shownBox(opened.ok ? opened.register : null, target, file)
        setPending(true)
        const name = before === null ? null : boxName(before, box)
        if (bound.current.has(target)) void deck.shown.showEdited(current)
        if (before === null || name === null) return
        record({ name, undoable: { steps: [{ node: target, before: boxPatch(before), after: boxPatch(box) }] } })
      },
      refused,
    )
    settle(outcome)
  }

  function holding<T>(target: ElementId, work: () => Promise<T>): Promise<T> {
    const release = busy.current.hold(target)
    return work().finally(release)
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
        onOrder={orderElement}
        onGroup={changeElement}
      >
        {({ notice, order, group, choose, clear }) => (
          <SlideCanvas
            className="overflow-clip rounded-[2px] focus-within:overflow-visible"
            entering={entering}
            formatting={formatting.current}
            notice={notice}
            onBox={(target, box) => {
              clear()
              void holding(target, () => onBox(target, box))
            }}
            onOrder={order}
            onSelect={select}
            onChoose={choose}
            onConnect={(node, end, to) => {
              clear()
              changeDesign(deck, endChange(node, end, to))
            }}
            onGroup={(nodes) => {
              clear()
              group({ change: "group", nodes })
            }}
            onUngroup={(node) => {
              clear()
              group({ change: "ungroup", node })
            }}
            onRemove={(target) => {
              clear()
              void holding(target, () => changeElement({ change: "remove", node: target }))
            }}
            onEdit={(target, value) => {
              clear()
              void holding(target, () => onEdit(target, value))
            }}
            onTable={(target, change) =>
              tables.change(target, change, (value, name) => holding(target, () => onEdit(target, value, name)))
            }
            slide={canvas}
            slideName={slideCount > 0 ? slideListCopy.slideName(current + 1, slideCount) : undefined}
            tableBar={tables.tableBar}
            store={store.current}
            width={width}
          />
        )}
      </ArrangeMenu>
    )
  }
}
