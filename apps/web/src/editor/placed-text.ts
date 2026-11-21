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
import type { StoreLane } from "@/editor/store-lane"
import { fileSlides } from "@/slide-edit"
import type { RecordHold } from "@/undo-list"

type Parts = ReadonlyMap<string, Uint8Array>

export type PlacedText = {
  readonly node: ElementId
  readonly file: readonly SlideId[]
  readonly add: SlideCommand
  readonly undoable: Undoable | null
  readonly kept: Promise<boolean> | null
}

export type PlacingLink = {
  readonly enqueueSlide: (
    deck: string,
    file: readonly SlideId[],
    edit: SlideCommand,
  ) => Promise<{ readonly ok: boolean }>
}

export type PlacingDeck = {
  readonly id: string
  readonly held: { current: readonly PlacedText[] }
  readonly parts: () => Parts
  readonly room: () => SlideRoom | null
  readonly index: () => number
  readonly painted: () => Register | null
  readonly show: () => void
  readonly showSaved: () => Promise<void>
  readonly enter: (node: ElementId, keys: HeldKeys) => void
  readonly hold: () => RecordHold
  readonly lane: StoreLane
}

export function placedOn(register: Register, placed: readonly PlacedText[]): Register {
  return placed.reduce((shown, each) => {
    const decision = decide(shown, { command: "slide", file: each.file, edit: each.add })
    return decision.decision === "apply" ? decision.register : shown
  }, register)
}

export function hasWords(value: string): boolean {
  return textValue(value).some((paragraph) => paragraph.runs.some((run) => run.text !== ""))
}

export function placingText(deck: PlacingDeck, link: PlacingLink) {
  const { id, held } = deck

  function place(place: TextPlace, keys: HeldKeys): void {
    const room = deck.room()
    const painted = deck.painted()
    const parts = deck.parts()
    if (painted === null || room === null) {
      keys.stop()
      return
    }
    const shown = placedOn(painted, held.current)
    const add = elementCommand(parts, shown, { change: "text", index: deck.index(), size: room, place })
    if (add?.slide !== "element-add") {
      keys.stop()
      return
    }
    const file = fileSlides(parts, shown)
    if (decide(shown, { command: "slide", file, edit: add }).decision !== "apply") {
      keys.stop()
      return
    }
    const node = add.element.node
    const placed = { node, file, add, undoable: slideUndoable(shown, file, add), kept: null }
    held.current = [...held.current, placed]
    deck.show()
    deck.enter(node, keys)
  }

  async function keep(placed: PlacedText): Promise<boolean> {
    const slot = deck.hold()
    try {
      const stored = await deck.lane(() => link.enqueueSlide(id, placed.file, placed.add))
      held.current = held.current.filter((each) => each.node !== placed.node)
      if (!stored.ok) {
        await deck.showSaved()
        return false
      }
      if (placed.undoable !== null) slot.record({ name: "add-box", undoable: placed.undoable })
      return true
    } finally {
      slot.release()
    }
  }

  function heldAt(node: ElementId): PlacedText | undefined {
    return held.current.find((each) => each.node === node)
  }

  function stored(node: ElementId): Promise<boolean> {
    const placed = heldAt(node)
    if (placed === undefined) return deck.lane.stored().then(() => true)
    return placed.kept ?? Promise.resolve(false)
  }

  function typed(node: ElementId, value: string): Promise<boolean> {
    const placed = heldAt(node)
    if (placed !== undefined && placed.kept === null && hasWords(value)) {
      const keeping = { ...placed, kept: keep(placed) }
      held.current = held.current.map((each) => (each.node === node ? keeping : each))
    }
    return stored(node)
  }

  function left(node: ElementId): boolean {
    const placed = heldAt(node)
    if (placed === undefined || placed.kept !== null) return false
    held.current = held.current.filter((each) => each.node !== node)
    void deck.showSaved()
    return true
  }

  return { place, typed, stored, left }
}
