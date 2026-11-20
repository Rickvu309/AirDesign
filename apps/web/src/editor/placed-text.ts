import {
  decide,
  slideUndoable,
  type ElementId,
  type Register,
  type SlideCommand,
  type SlideId,
  type Undoable,
} from "@airdesign/document"
import { textValue, type HeldKeys } from "@airdesign/render"
import { elementCommand, type SlideRoom, type TextPlace } from "@/element-edit"
import { fileSlides } from "@/slide-edit"
import type { UndoEntry } from "@/undo-list"

type Parts = ReadonlyMap<string, Uint8Array>

export type PlacedText = {
  readonly node: ElementId
  readonly file: readonly SlideId[]
  readonly add: SlideCommand
  readonly undoable: Undoable | null
  readonly kept: Promise<boolean> | null
}

export type PlacingLink = {
  readonly openDeck: (
    deck: string,
  ) => Promise<{ readonly ok: true; readonly register: Register } | { readonly ok: false }>
  readonly enqueueSlide: (
    deck: string,
    file: readonly SlideId[],
    edit: SlideCommand,
  ) => Promise<{ readonly ok: boolean }>
}

export type PlacingDeck = {
  readonly id: string
  readonly held: { current: PlacedText | null }
  readonly parts: () => Parts
  readonly room: () => SlideRoom | null
  readonly index: () => number
  readonly showSaved: () => Promise<void>
  readonly enter: (node: ElementId, keys: HeldKeys) => void
  readonly record: (entry: UndoEntry) => void
}

export function placedOn(register: Register, placed: PlacedText | null): Register {
  if (placed === null || placed.kept !== null) return register
  const decision = decide(register, { command: "slide", file: placed.file, edit: placed.add })
  return decision.decision === "apply" ? decision.register : register
}

export function hasWords(value: string): boolean {
  return textValue(value).some((paragraph) => paragraph.runs.some((run) => run.text !== ""))
}

export function placingText(deck: PlacingDeck, link: PlacingLink) {
  const { id, held } = deck

  async function place(place: TextPlace, keys: HeldKeys): Promise<void> {
    const room = deck.room()
    const opened = room === null ? null : await link.openDeck(id)
    const parts = deck.parts()
    if (opened?.ok !== true || room === null) {
      keys.stop()
      return
    }
    const add = elementCommand(parts, opened.register, { change: "text", index: deck.index(), size: room, place })
    if (add?.slide !== "element-add") {
      keys.stop()
      return
    }
    const file = fileSlides(parts, opened.register)
    if (decide(opened.register, { command: "slide", file, edit: add }).decision !== "apply") {
      keys.stop()
      return
    }
    const node = add.element.node
    held.current = { node, file, add, undoable: slideUndoable(opened.register, file, add), kept: null }
    await deck.showSaved()
    deck.enter(node, keys)
  }

  async function keep(placed: PlacedText): Promise<boolean> {
    const stored = await link.enqueueSlide(id, placed.file, placed.add)
    if (held.current?.node === placed.node) held.current = null
    if (!stored.ok) {
      await deck.showSaved()
      return false
    }
    if (placed.undoable !== null) deck.record({ name: "add-box", undoable: placed.undoable })
    return true
  }

  function stored(node: ElementId): Promise<boolean> {
    const placed = held.current
    if (placed === null || placed.node !== node) return Promise.resolve(true)
    return placed.kept ?? Promise.resolve(false)
  }

  function typed(node: ElementId, value: string): Promise<boolean> {
    const placed = held.current
    if (placed?.node === node && placed.kept === null && hasWords(value))
      held.current = { ...placed, kept: keep(placed) }
    return stored(node)
  }

  function left(node: ElementId): void {
    const placed = held.current
    if (placed === null || placed.node !== node || placed.kept !== null) return
    held.current = null
    void deck.showSaved()
  }

  return { place, typed, stored, left }
}
