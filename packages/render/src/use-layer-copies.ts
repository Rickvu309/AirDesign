import type { Box, ElementId } from "@airdesign/document"
import { useLayoutEffect, useRef, useState } from "react"
import { boxOf, type Moved } from "./box-gesture.js"
import type { DragSnap } from "./drag-snap.js"
import { copiesInPlace, copyBoard, copySnap, lastOffset, type Copied, type CopyBoard } from "./layer-copies.js"
import type { CanvasSlide } from "./record.js"
import { parentOf, type Selection } from "./selection.js"
import type { BoxGrip, PaintStore } from "./store.js"

export type Duplicate = (copies: readonly Moved[]) => Promise<readonly Copied[]>

type Awaited = {
  readonly ids: readonly ElementId[]
  readonly grips: readonly BoxGrip[]
  readonly from: HTMLElement | null
}

export type LayerCopies = {
  readonly board: CopyBoard
  readonly copying: () => boolean
  readonly dragging: (
    snap: DragSnap,
    starts: ReadonlyMap<ElementId, Box>,
  ) => { readonly copySnap?: DragSnap; readonly onCopying?: (copying: boolean) => void }
  readonly land: (starts: ReadonlyMap<ElementId, Box>, grips: readonly BoxGrip[], from: HTMLElement | null) => void
  readonly duplicate: (starts: ReadonlyMap<ElementId, Box>, from: HTMLElement) => boolean
}

function labelOf(ids: readonly ElementId[], from: HTMLElement | null): string {
  if (ids.length > 1) return `${String(ids.length)} layers`
  return from?.getAttribute("aria-label") ?? ""
}

function painted(slide: CanvasSlide, ids: readonly ElementId[]): boolean {
  return ids.every((id) => slide.elements.some((each) => each.id === id))
}

export function useLayerCopies(options: {
  readonly store: PaintStore
  readonly slide: CanvasSlide
  readonly choose: (next: Selection) => void
  readonly focus: (from: HTMLElement, next: Selection) => void
  readonly say: (message: string) => void
  readonly onDuplicate: Duplicate | undefined
}): LayerCopies {
  const { store, slide, onDuplicate } = options
  const [board] = useState(copyBoard)
  const copying = useRef(false)
  const last = useRef<readonly Copied[]>([])
  const awaited = useRef<Awaited | null>(null)
  const landing = useRef(false)
  const queued = useRef(false)
  const shown = useRef(slide)
  const chosen = useRef(options)
  chosen.current = options

  function settle() {
    const waiting = awaited.current
    if (waiting === null || !painted(shown.current, waiting.ids)) return
    awaited.current = null
    landing.current = false
    for (const grip of waiting.grips) grip.release()
    board.show([])
    const [lead] = waiting.ids
    const next = { ids: waiting.ids, inside: lead === undefined ? null : parentOf(shown.current, lead) }
    chosen.current.choose(next)
    if (waiting.from?.isConnected === true) chosen.current.focus(waiting.from, next)
    chosen.current.say(`Duplicated ${labelOf(waiting.ids, waiting.from)}`)
    if (!queued.current) return
    queued.current = false
    const starts = new Map(
      waiting.ids.flatMap((id): [ElementId, Box][] => {
        const box = restingOf(id)
        return box === null ? [] : [[id, box]]
      }),
    )
    copyInPlace(starts, waiting.from)
  }

  useLayoutEffect(() => {
    shown.current = slide
    settle()
  }, [slide])

  function restingOf(id: ElementId): Box | null {
    const box = shown.current.elements.find((each) => each.id === id)?.box ?? null
    return store.getBox(id) ?? (box === null ? null : boxOf(box))
  }

  function send(copies: readonly Moved[], grips: readonly BoxGrip[], from: HTMLElement | null) {
    landing.current = true
    const sent = onDuplicate === undefined ? Promise.resolve([]) : onDuplicate(copies)
    function lost() {
      landing.current = false
      queued.current = false
      for (const grip of grips) grip.release()
      board.show([])
    }
    sent.then((made) => {
      if (made.length === 0) {
        lost()
        return
      }
      last.current = made
      awaited.current = { ids: made.map((each) => each.copy), grips, from }
      settle()
    }, lost)
  }

  function copyInPlace(starts: ReadonlyMap<ElementId, Box>, from: HTMLElement | null): boolean {
    if (starts.size === 0) return false
    const offset = lastOffset([...starts.keys()], last.current, restingOf)
    send(copiesInPlace(starts, offset), [], from)
    return true
  }

  return {
    board,
    copying: () => copying.current,
    dragging(snap, starts) {
      copying.current = false
      if (onDuplicate === undefined) return {}
      return {
        copySnap: copySnap(snap, starts),
        onCopying(now) {
          copying.current = now
          board.show(now ? [...starts.keys()] : [])
        },
      }
    },
    land(starts, grips, from) {
      copying.current = false
      board.show([...starts.keys()])
      const copies = [...starts.keys()].flatMap((id): Moved[] => {
        const box = store.getBox(id)
        return box === null ? [] : [{ id, box }]
      })
      send(copies, grips, from)
    },
    duplicate(starts, from) {
      if (onDuplicate === undefined) return false
      if (landing.current) {
        queued.current = true
        return true
      }
      return copyInPlace(starts, from)
    },
  }
}
