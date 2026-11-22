import type { ElementId } from "@airdesign/document"
import { SlideCanvas, type FitSize, type PaintStore } from "@airdesign/render"
import type { SlideCanvases } from "@/editing/canvas-source"

export function owingSlides(store: PaintStore, owed: ReadonlySet<ElementId>, shown: number): readonly number[] {
  if (owed.size === 0) return []
  return store
    .slides()
    .flatMap((slide, index) => (index !== shown && slide.elements.some((node) => owed.has(node)) ? [index] : []))
}

export function MeasuredSlides(props: {
  readonly slides: readonly number[]
  readonly canvases: SlideCanvases
  readonly store: PaintStore
  readonly width: number
  readonly onFit: (node: ElementId, size: FitSize) => void
}) {
  if (props.slides.length === 0) return null
  return (
    <div aria-hidden="true" data-measured-slides className="pointer-events-none invisible fixed top-0 left-0">
      {props.slides.map((index) => {
        const slide = props.canvases(index)
        return slide === null ? null : (
          <SlideCanvas
            key={index}
            measuring
            slide={slide}
            store={props.store}
            width={props.width}
            onFit={props.onFit}
          />
        )
      })}
    </div>
  )
}
