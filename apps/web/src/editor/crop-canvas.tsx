import { SlideCanvas, leadOf, type CanvasElement, type PaintBox } from "@airdesign/render"
import { useRef, useState, type ComponentProps, type PointerEvent } from "react"
import type { ElementId } from "@airdesign/document"
import { picturePanelCopy } from "@/copy/picture-panel-copy"
import { draggedCrop, type CropRect } from "@/design/crop-change"

type Crop = { readonly node: ElementId; readonly rect: CropRect; readonly commit: (next: CropRect) => void }

const positions = [
  { edges: ["t", "l"], x: 0, y: 0, label: "topLeft", cursor: "nwse-resize" },
  { edges: ["t"], x: 50, y: 0, label: "top", cursor: "ns-resize" },
  { edges: ["t", "r"], x: 100, y: 0, label: "topRight", cursor: "nesw-resize" },
  { edges: ["r"], x: 100, y: 50, label: "right", cursor: "ew-resize" },
  { edges: ["b", "r"], x: 100, y: 100, label: "bottomRight", cursor: "nwse-resize" },
  { edges: ["b"], x: 50, y: 100, label: "bottom", cursor: "ns-resize" },
  { edges: ["b", "l"], x: 0, y: 100, label: "bottomLeft", cursor: "nesw-resize" },
  { edges: ["l"], x: 0, y: 50, label: "left", cursor: "ew-resize" },
] as const

type Edges = readonly (keyof CropRect)[]

const bracket = "size-3 border-foreground"
const bar = "rounded-full bg-foreground ring-1 ring-background"

const cropMark: Readonly<Record<string, string>> = {
  tl: `${bracket} translate-x-1/4 translate-y-1/4 border-t-3 border-l-3`,
  tr: `${bracket} -translate-x-1/4 translate-y-1/4 border-t-3 border-r-3`,
  br: `${bracket} -translate-x-1/4 -translate-y-1/4 border-b-3 border-r-3`,
  bl: `${bracket} translate-x-1/4 -translate-y-1/4 border-b-3 border-l-3`,
  t: `${bar} h-0.75 w-4`,
  b: `${bar} h-0.75 w-4`,
  l: `${bar} h-4 w-0.75`,
  r: `${bar} h-4 w-0.75`,
}

function sourceDelta(x: number, y: number, box: PaintBox) {
  const angle = (-box.rotation * Math.PI) / 180
  const across = x * Math.cos(angle) - y * Math.sin(angle)
  const down = x * Math.sin(angle) + y * Math.cos(angle)
  return { x: box.flipH ? -across : across, y: box.flipV ? -down : down }
}

function sourceEdges(edges: Edges, box: PaintBox): Edges {
  return edges.map((edge) => {
    if (box.flipH && (edge === "l" || edge === "r")) return edge === "l" ? "r" : "l"
    if (box.flipV && (edge === "t" || edge === "b")) return edge === "t" ? "b" : "t"
    return edge
  })
}

function cropWindow(start: CropRect, next: CropRect, box: PaintBox) {
  const across = 100_000 - start.l - start.r
  const down = 100_000 - start.t - start.b
  const left = box.flipH ? next.r - start.r : next.l - start.l
  const top = box.flipV ? next.b - start.b : next.t - start.t
  return {
    left: `${(left / across) * 100}%`,
    top: `${(top / down) * 100}%`,
    width: `${((100_000 - next.l - next.r) / across) * 100}%`,
    height: `${((100_000 - next.t - next.b) / down) * 100}%`,
  }
}

function CropHandles({ crop, box, scale }: { crop: Crop; box: PaintBox; scale: number }) {
  const [draft, setDraft] = useState<CropRect | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; x: number; y: number; zoom: number; edges: Edges } | null>(null)
  const size = { width: box.width * scale, height: box.height * scale }

  function pick(event: PointerEvent<HTMLButtonElement>, edges: Edges) {
    if (event.button !== 0 || frame.current === null) return
    const zoom = frame.current.parentElement?.getBoundingClientRect().width ?? 0
    const width = frame.current.parentElement?.clientWidth ?? 0
    if (zoom <= 0 || width <= 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, zoom: zoom / width, edges }
  }

  function nextCrop(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current
    if (start === null || start.pointer !== event.pointerId) return null
    const delta = sourceDelta((event.clientX - start.x) / start.zoom, (event.clientY - start.y) / start.zoom, box)
    return draggedCrop(crop.rect, sourceEdges(start.edges, box), delta, size)
  }

  function commit(next: CropRect) {
    if (next.l !== crop.rect.l || next.t !== crop.rect.t || next.r !== crop.rect.r || next.b !== crop.rect.b)
      crop.commit(next)
  }

  function cancel() {
    drag.current = null
    setDraft(null)
  }

  function finish(event: PointerEvent<HTMLButtonElement>) {
    const next = nextCrop(event)
    cancel()
    if (next !== null) commit(next)
  }

  return (
    <div
      ref={frame}
      data-keeps-selection
      className="pointer-events-none absolute"
      style={{
        left: box.x * scale,
        top: box.y * scale,
        ...size,
        transform: `rotate(${box.rotation}deg)`,
      }}
    >
      <div
        data-crop-frame
        className="absolute border border-primary"
        style={cropWindow(crop.rect, draft ?? crop.rect, box)}
      >
        {positions.map(({ edges, x, y, label, cursor }) => (
          <button
            key={label}
            type="button"
            aria-label={picturePanelCopy.cropHandles[label]}
            data-crop-handle={edges.join("-")}
            className="pointer-events-auto absolute grid size-5 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center"
            style={{ left: `${x}%`, top: `${y}%`, cursor }}
            onPointerDown={(event) => pick(event, edges)}
            onPointerMove={(event) => {
              const next = nextCrop(event)
              if (next !== null) setDraft(next)
            }}
            onPointerUp={finish}
            onPointerCancel={cancel}
            onLostPointerCapture={cancel}
            onKeyDown={(event) => {
              const x = Number(event.key === "ArrowRight") - Number(event.key === "ArrowLeft")
              const y = Number(event.key === "ArrowDown") - Number(event.key === "ArrowUp")
              if (x === 0 && y === 0) return
              event.preventDefault()
              const stride = event.shiftKey ? 10 : 1
              const delta = sourceDelta(x * stride, y * stride, box)
              commit(draggedCrop(crop.rect, sourceEdges(edges, box), delta, size))
            }}
          >
            <span className={cropMark[edges.join("")] ?? ""} />
          </button>
        ))}
      </div>
    </div>
  )
}

type Props = ComponentProps<typeof SlideCanvas> & { readonly cropTarget: () => Crop | null }

export function CropCanvas({ cropTarget, ...props }: Props) {
  const [active, setActive] = useState<ElementId | null>(null)
  const lead = props.selection?.ids.length === 1 ? leadOf(props.selection) : null
  const element = lead === null ? undefined : props.slide.elements.find((each) => each.id === lead)
  const crop = active === null || active !== lead ? null : cropTarget()
  const box = element?.box
  const opened = crop !== null && crop.node === active && box != null

  function open(target: EventTarget) {
    if (!overImage(target, element)) return false
    const picked = cropTarget()
    if (picked === null || picked.node !== lead) return false
    setActive(picked.node)
    return true
  }

  return (
    <div
      className="relative"
      onDoubleClickCapture={(event) => {
        if (!open(event.target)) return
        event.preventDefault()
        event.stopPropagation()
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && opened) {
          event.stopPropagation()
          setActive(null)
        } else if (event.key === "Enter" && !opened && open(event.target)) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
    >
      <SlideCanvas
        {...props}
        hideSelectionFrame={opened}
        onSelection={(selection) => {
          if (selection.ids.length !== 1 || leadOf(selection) !== active) setActive(null)
          props.onSelection?.(selection)
        }}
      />
      {opened ? <CropHandles key={crop.node} crop={crop} box={box} scale={props.width / props.slide.width} /> : null}
    </div>
  )
}

function overImage(target: EventTarget, element: CanvasElement | undefined): boolean {
  return (
    element !== undefined &&
    target instanceof Element &&
    target.closest("[data-canvas-element]")?.getAttribute("data-canvas-element") === element.key
  )
}
