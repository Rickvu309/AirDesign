import { memo, useCallback, useMemo, useSyncExternalStore } from "react"
import type { Box, ElementId, SlideId } from "@airdesign/document"
import type { ElementRecord } from "./record.js"
import type { PaintStore } from "./store.js"

export function useElement(store: PaintStore, id: ElementId): ElementRecord | null {
  return useSyncExternalStore(
    store.elementSubscribe(id),
    () => store.getElement(id),
    () => store.getElement(id),
  )
}

export type BoxRead = (store: PaintStore, id: ElementId) => Box | null

export const shownBox: BoxRead = (store, id) => store.getBox(id)

export const restingBox: BoxRead = (store, id) => store.getRestingBox(id)

export function useLaid(store: PaintStore, id: ElementId, read: BoxRead = shownBox): Box | null {
  const laid = useSyncExternalStore(
    store.boxSubscribe(id),
    () => store.getLaid(id),
    () => store.getLaid(id),
  )
  return read === shownBox ? laid : null
}

export function useBox(store: PaintStore, id: ElementId, read: BoxRead = shownBox): Box | null {
  return useSyncExternalStore(
    store.boxSubscribe(id),
    () => read(store, id),
    () => read(store, id),
  )
}

function boxText(box: Box | null): string {
  return box === null ? "-" : `${String(box.x)},${String(box.y)},${String(box.cx)},${String(box.cy)}`
}

export function useBoxes(
  store: PaintStore,
  ids: readonly ElementId[],
  read: BoxRead = shownBox,
): readonly (Box | null)[] {
  const key = ids.join(" ")
  const subscribe = useCallback(
    (listener: () => void) => {
      const stops = ids.map((id) => store.boxSubscribe(id)(listener))
      return () => {
        for (const stop of stops) stop()
      }
    },
    [store, key],
  )
  const snapshot = () => ids.map((id) => boxText(read(store, id))).join(" ")
  const shown = useSyncExternalStore(subscribe, snapshot, snapshot)
  return useMemo(() => ids.map((id) => read(store, id)), [store, key, shown, read])
}

export function useRotation(store: PaintStore, id: ElementId): number | null {
  return useSyncExternalStore(
    store.boxSubscribe(id),
    () => store.getRotation(id),
    () => store.getRotation(id),
  )
}

function useSlide(store: PaintStore, id: SlideId) {
  return useSyncExternalStore(
    store.slideSubscribe(id),
    () => store.getSlide(id),
    () => store.getSlide(id),
  )
}

type ElementViewProps = {
  readonly store: PaintStore
  readonly id: ElementId
  readonly onPaint?: ((id: ElementId) => void) | undefined
}

export const ElementView = memo(function ElementView(props: ElementViewProps) {
  const record = useElement(props.store, props.id)
  props.onPaint?.(props.id)
  return <span data-element={props.id}>{record === null ? "" : record.text}</span>
})

type OpenSlideProps = {
  readonly store: PaintStore
  readonly id: SlideId
  readonly label?: string | undefined
  readonly onPaint?: (() => void) | undefined
  readonly onElementPaint?: ((id: ElementId) => void) | undefined
}

export function OpenSlide(props: OpenSlideProps) {
  const slide = useSlide(props.store, props.id)
  props.onPaint?.()
  const elements = slide === null ? [] : slide.elements
  return (
    <section data-slide={props.id}>
      {props.label ?? ""}
      {elements.map((id) => (
        <ElementView key={id} store={props.store} id={id} onPaint={props.onElementPaint} />
      ))}
    </section>
  )
}
