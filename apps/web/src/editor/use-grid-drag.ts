import { useRef, useState, type CSSProperties, type DragEvent, type RefObject } from "react"
import { dropPlace, dropTarget, edgeScroll, previewSlot, slotUnder, type GridSlot } from "@/editor/grid-drop"
import { gridGap } from "@/editor/grid-size"
import { still } from "@/editor/slide-opening"

type Range = { readonly start: number; readonly end: number }

type Preview = { readonly from: number; readonly to: number | null; readonly moving: boolean }

const slideMotion = "transform var(--ease-panel)"

function rowOf(rows: readonly Range[], index: number): Range | undefined {
  return rows.find((row) => index >= row.start && index < row.end)
}

function slotsIn(scroller: HTMLElement): readonly GridSlot[] {
  const box = scroller.getBoundingClientRect()
  return [...scroller.querySelectorAll<HTMLElement>("[data-slide-entry]")].map((card) => {
    const rect = card.getBoundingClientRect()
    return {
      index: Number(card.dataset.slideEntry) - 1,
      left: rect.left - box.left + scroller.scrollLeft,
      top: rect.top - box.top + scroller.scrollTop,
      width: rect.width,
      height: rect.height,
    }
  })
}

export function useGridDrag({
  list,
  bar,
  rows,
  onMove,
}: {
  list: RefObject<HTMLDivElement | null>
  bar: RefObject<HTMLDivElement | null>
  rows: readonly Range[]
  onMove: (from: number, to: number) => void
}) {
  const place = useRef<number | null>(null)
  const slots = useRef<readonly GridSlot[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [settling, setSettling] = useState(false)

  function hideBar() {
    const mark = bar.current
    if (mark !== null) mark.hidden = true
  }

  function showBar(at: number, index: number) {
    const mark = bar.current
    const after = at !== index || rows.some((row) => row.start === at && at > 0)
    const slot = slots.current.find((each) => each.index === (after ? at - 1 : index))
    if (mark === null || slot === undefined) {
      place.current = null
      hideBar()
      return
    }
    const left = after ? slot.left + slot.width + gridGap / 2 : slot.left - gridGap / 2
    mark.hidden = false
    mark.dataset.dropPlace = String(at + 1)
    mark.style.height = `${slot.height}px`
    mark.style.transform = `translate(${left - 2}px, ${slot.top}px)`
  }

  function end() {
    place.current = null
    slots.current = []
    setPreview(null)
    hideBar()
  }

  function start(index: number, event: DragEvent<HTMLElement>) {
    event.dataTransfer.setData("text/plain", String(index))
    event.dataTransfer.effectAllowed = "move"
    const scroller = list.current
    slots.current = scroller === null ? [] : slotsIn(scroller)
    setSettling(false)
    setPreview({ from: index, to: null, moving: !still() })
  }

  function over(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const scroller = event.currentTarget
    const box = scroller.getBoundingClientRect()
    const step = edgeScroll(event.clientY, { top: box.top, height: box.height })
    if (step !== 0) scroller.scrollTop += step
    if (preview === null) return
    const x = event.clientX - box.left + scroller.scrollLeft
    const y = event.clientY - box.top + scroller.scrollTop
    const slot = slotUnder(x, y, slots.current)
    if (slot === undefined) return
    const at = dropPlace(x, slot, slot.index)
    place.current = at
    const to = dropTarget(preview.from, at)
    const home = rowOf(rows, preview.from)
    const moves =
      preview.moving && home !== undefined && home === rowOf(rows, slot.index) && !(at === home.start && at > 0)
    if (moves) hideBar()
    else showBar(at, slot.index)
    const next = moves ? to : null
    if (next !== preview.to) setPreview({ ...preview, to: next })
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const from = Number(event.dataTransfer.getData("text/plain"))
    const at = place.current
    setSettling(true)
    end()
    if (!Number.isInteger(from) || at === null) return
    const to = dropTarget(from, at)
    if (to !== null) onMove(from, to)
  }

  function shift(index: number): CSSProperties | undefined {
    if (preview === null) return settling ? { transition: "none" } : { transition: slideMotion }
    const target = previewSlot(index, preview.from, preview.to)
    const here = slots.current.find((slot) => slot.index === index)
    const there = slots.current.find((slot) => slot.index === target)
    if (here === undefined || there === undefined || target === index) return { transition: slideMotion }
    return {
      transform: `translate(${there.left - here.left}px, ${there.top - here.top}px)`,
      transition: slideMotion,
    }
  }

  return { dragging: preview?.from ?? null, start, over, drop, end, shift }
}
