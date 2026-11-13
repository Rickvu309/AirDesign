import { type Box, type ElementId } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { SlideCanvas, textValue } from "@airdesign/render"
import type { ReactNode } from "react"
import { commitBox, commitEdit, type CommitOutcome } from "@/commit-edit"
import { valueStorable } from "@/deck-paint"
import { deviceRegister } from "@/device-copy"
import { slideFrame } from "@/editor/revenue-slide"
import type { DeckPaint } from "@/editor/use-deck-paint"
import type { UndoList } from "@/editor/use-undo"
import type { ElementChange } from "@/element-edit"
import { landedBox, paintedBox, shownBox } from "@/element-move"
import { cn } from "@/lib/class-names"
import { showText, shownValue } from "@/live-repaint"
import type { useTables } from "@/table-hook"
import { boxName } from "@/undo-names"

export type EditableDeck = {
  readonly id: string
  readonly shown: DeckPaint
  readonly undo: UndoList
  readonly tables: ReturnType<typeof useTables>
  readonly settle: (outcome: CommitOutcome) => void
  readonly setPending: (pending: boolean) => void
  readonly changeElement: (change: ElementChange) => Promise<void>
}

export function editableSlide(deck: EditableDeck): (width: number) => ReactNode {
  const { id, tables, settle, setPending, changeElement } = deck
  const { store, boxes, movables, shapes, editParts, canvases, busy, entering, current } = deck.shown
  const { typed, sessions, records, formatting, record } = deck.undo

  async function textBefore(target: ElementId): Promise<string> {
    const file = boxes.current.get(target)?.file ?? ""
    return shownValue(await deviceRegister(id), target, file)
  }

  function onEdit(target: ElementId, value: string) {
    const release = records.current.hold()
    return editText(target, value, release).finally(release)
  }

  async function editText(target: ElementId, value: string, release: () => void) {
    if (typed.current?.node !== target) {
      sessions.current += 1
      typed.current = { node: target, session: sessions.current, before: textBefore(target) }
    }
    const { session } = typed.current
    const started = typed.current.before
    const box = boxes.current.get(target)
    if (box === undefined) return
    const file = box.file
    async function refused() {
      showText(store.current, target, shownValue(await deviceRegister(id), target, file))
    }
    const shape = shapes.current.get(target)
    if (shape === undefined || !valueStorable(editParts.current, shape, textValue(value))) {
      await refused()
      return
    }
    const outcome = await commitEdit(
      connect,
      id,
      value,
      box,
      async () => {
        const before = await started
        setPending(true)
        showText(store.current, target, value)
        record({
          name: "text",
          session,
          undoable: { node: target, floor: file, before: { value: before }, after: { value } },
        })
        release()
      },
      refused,
    )
    settle(outcome)
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
        if (before === null || name === null) return
        record({
          name,
          undoable: {
            node: target,
            floor: element.file,
            before: { property: "box", value: before },
            after: { property: "box", value: box },
          },
        })
      },
      refused,
    )
    settle(outcome)
  }

  function holding(target: ElementId, work: () => Promise<void>) {
    const release = busy.current.hold(target)
    void work().finally(release)
  }

  return (width) => {
    const canvas = canvases.current(current)
    return canvas === null ? (
      <div />
    ) : (
      <SlideCanvas
        className={cn(slideFrame, "shrink-0 overflow-clip focus-within:overflow-visible")}
        entering={entering}
        formatting={formatting.current}
        onBox={(target, box) => holding(target, () => onBox(target, box))}
        onRemove={(target) => holding(target, () => changeElement({ change: "remove", node: target }))}
        onEdit={(target, value) => holding(target, () => onEdit(target, value))}
        slide={canvas}
        {...tables.canvas}
        store={store.current}
        width={width}
      />
    )
  }
}
