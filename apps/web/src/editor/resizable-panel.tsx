import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"
import { designCopy } from "@/copy/design-copy"

type Panel = "design" | "agent"
type Drag = { readonly x: number; readonly width: number }

const defaults: Readonly<Record<Panel, number>> = { design: 240, agent: 360 }
const minimum = 220
const maximum = 440
const bounded = (width: number) => Math.max(minimum, Math.min(maximum, width))

export function ResizablePanel({ panel, children }: { panel: Panel; children: ReactNode }) {
  const [widths, setWidths] = useState(defaults)
  const drag = useRef<Drag | null>(null)
  const width = widths[panel]
  const resize = (value: number) => setWidths((held) => ({ ...held, [panel]: bounded(value) }))

  function start(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, width }
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (drag.current !== null) resize(drag.current.width + drag.current.x - event.clientX)
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 40 : 10
    switch (event.key) {
      case "ArrowLeft":
        resize(width + step)
        break
      case "ArrowRight":
        resize(width - step)
        break
      case "Home":
        resize(minimum)
        break
      case "End":
        resize(maximum)
        break
      default:
        return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-line bg-white"
      style={{ width }}
      id="editor-panel"
      data-editor-panel
    >
      <div
        role="separator"
        aria-label={designCopy.resizePanel}
        aria-orientation="vertical"
        aria-valuemin={minimum}
        aria-valuemax={maximum}
        aria-valuenow={width}
        tabIndex={0}
        data-keeps-selection
        className="group absolute inset-y-0 -left-1 z-30 w-2 cursor-col-resize touch-none outline-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => {
          drag.current = null
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
        onLostPointerCapture={() => {
          drag.current = null
        }}
        onDoubleClick={() => resize(defaults[panel])}
        onKeyDown={key}
      >
        <span className="absolute top-1/2 left-0.5 h-8 w-1 -translate-y-1/2 rounded-full bg-line group-hover:bg-primary group-focus-visible:bg-primary group-active:bg-primary" />
      </div>
      {children}
    </aside>
  )
}
