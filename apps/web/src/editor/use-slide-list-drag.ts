import {
  useEffect,
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type PointerEvent as RowPointerEvent,
  type RefObject,
} from "react"
import { flushSync } from "react-dom"
import { composing } from "@/lib/composing"
import { dragOrder, dragPlace, dragTarget, type SlideDrag } from "@/editor/slide-list-drag"
import { glideRows, rowPitch, shiftRow, slideGlides, slideRows } from "@/editor/slide-list-glide"

const slop = 4
const edge = 40
const fastest = 14

export type SlideDrop = {
  readonly held: readonly number[]
  readonly grabbed: number
  readonly place: number
  readonly at: number
}

type Lifted = {
  readonly drag: SlideDrag
  readonly rows: readonly HTMLElement[]
  readonly pitch: number
  place: number
}

export function useSlideListDrag(
  list: RefObject<HTMLElement | null>,
  ids: readonly string[],
  heldWith: (index: number) => readonly number[],
  onDrop: (drop: SlideDrop) => void,
) {
  const ending = useRef<(() => void) | null>(null)
  const swallow = useRef(false)
  const shown = useRef<readonly string[]>(ids)
  const key = ids.join(",")
  useLayoutEffect(() => {
    const next = key === "" ? [] : key.split(",")
    const glides = slideGlides(shown.current, next)
    shown.current = next
    if (glides === null || list.current === null) return
    ending.current?.()
    glideRows(list.current, glides)
  }, [list, key])
  useEffect(() => () => ending.current?.(), [])

  const onPointerDown = (index: number, event: RowPointerEvent<HTMLButtonElement>) => {
    const root = list.current
    swallow.current = false
    if (root === null || event.button !== 0 || event.pointerType === "touch") return
    ending.current?.()
    const row = event.currentTarget
    const startY = event.clientY
    const grab = startY - row.getBoundingClientRect().top
    let y = startY
    let lifted: Lifted | null = null
    let frame = 0

    const place = (held: Lifted) => {
      const origin = held.rows[0]?.parentElement?.getBoundingClientRect().top ?? 0
      const reach = (held.drag.count - 1) * held.pitch + held.pitch / 2
      const top = Math.max(-held.pitch / 2, Math.min(reach, y - grab - origin))
      held.place = dragPlace(held.drag, Math.round(top / held.pitch))
      dragOrder(held.drag, held.place).forEach((each, position) => {
        const by = each === index ? top - each * held.pitch : (position - each) * held.pitch
        const moved = held.rows[each]
        if (moved !== undefined) shiftRow(moved, by)
      })
    }

    const scroll = () => {
      frame = requestAnimationFrame(scroll)
      if (lifted === null) return
      const box = root.getBoundingClientRect()
      const pull = y < box.top + edge ? y - box.top - edge : y > box.bottom - edge ? y - box.bottom + edge : 0
      const before = root.scrollTop
      root.scrollTop += Math.max(-fastest, Math.min(fastest, pull / 3))
      if (root.scrollTop !== before) place(lifted)
    }

    const lift = (): Lifted | null => {
      const rows = [...root.querySelectorAll<HTMLElement>(slideRows)]
      const pitch = rowPitch(root, rows)
      if (pitch <= 0) return null
      row.setAttribute("data-slide-held", "")
      frame = requestAnimationFrame(scroll)
      const held = [...heldWith(index)].sort((one, other) => one - other)
      return { drag: { count: rows.length, held, grabbed: index }, rows, pitch, place: 0 }
    }

    const end = (drop: boolean) => {
      removeEventListener("pointermove", onMove)
      removeEventListener("pointerup", onUp)
      removeEventListener("pointercancel", onCancel)
      removeEventListener("keydown", onKey, true)
      cancelAnimationFrame(frame)
      ending.current = null
      const held = lifted
      lifted = null
      if (held === null) return
      row.removeAttribute("data-slide-held")
      swallow.current = true
      const moved = drop && dragOrder(held.drag, held.place).some((each, position) => each !== position)
      if (moved)
        flushSync(() => {
          onDrop({ held: held.drag.held, grabbed: index, place: held.place, at: dragTarget(held.drag, held.place) })
        })
      glideRows(root, null)
    }

    const onMove = (moved: PointerEvent) => {
      y = moved.clientY
      if (lifted === null && Math.abs(y - startY) >= slop) lifted = lift()
      if (lifted !== null) place(lifted)
    }
    const onUp = () => {
      end(true)
      setTimeout(() => {
        swallow.current = false
      }, 0)
    }
    const onCancel = () => end(false)
    const onKey = (pressed: KeyboardEvent) => {
      if (composing(pressed) || pressed.key !== "Escape" || lifted === null) return
      pressed.preventDefault()
      pressed.stopPropagation()
      end(false)
    }
    ending.current = onCancel
    addEventListener("pointermove", onMove)
    addEventListener("pointerup", onUp)
    addEventListener("pointercancel", onCancel)
    addEventListener("keydown", onKey, true)
  }

  const onClickCapture = (event: MouseEvent) => {
    if (!swallow.current) return
    swallow.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  return { onPointerDown, onClickCapture }
}
