import * as doom from "@airdesign/doom"
import { propOf } from "@airdesign/doom"
import { useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { editorCopy } from "@/copy/editor-copy"
import { hitChain } from "@/editing/hit-test"
import { intentWrites } from "./editor-intents"
import { togglable, toggleIntents } from "./toggle-intents"
import { picked, unitOf, type Selection } from "./selection"
import type { SlideGeometry } from "@/editing/slide-geometry"
import type { EditorClient } from "./use-deck"

function editingText(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[contenteditable]") !== null
}

export function LayerMenu(props: {
  readonly children: ReactNode
  readonly view: doom.Doom
  readonly geometry: SlideGeometry
  readonly selection: Selection
  readonly onSelection: (next: Selection) => void
  readonly scale: number
  readonly client: EditorClient
  readonly slideBox: RefObject<HTMLDivElement | null>
}) {
  const chosen = useRef<readonly doom.NodeId[]>([])
  const point = useRef({ x: 0, y: 0 })
  const anchor = useRef({
    getBoundingClientRect() {
      return new DOMRect(point.current.x, point.current.y, 0, 0)
    },
  })
  const applied = useRef(false)
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState<string>(editorCopy.useAsMask)
  const { view, geometry, selection, onSelection, scale, client, slideBox } = props

  function onContextMenu(event: ReactMouseEvent) {
    if (editingText(event.target)) return
    event.preventDefault()
    const box = slideBox.current?.getBoundingClientRect()
    const layoutWidth = slideBox.current?.offsetWidth ?? 0
    const painted = box !== undefined && box.width > 0 && layoutWidth > 0 ? box.width / layoutWidth : 1
    const visual = Math.abs(painted - 1) < 0.001 ? scale : scale * painted
    const at =
      box === undefined || visual === 0
        ? { x: 0, y: 0 }
        : { x: (event.clientX - box.left) / visual, y: (event.clientY - box.top) / visual }
    const chain = hitChain(geometry.roots, at, 4.5 / (visual || 1), (id) => doom.lockedIn(view, id))
    if (chain === null) {
      chosen.current = []
      setOpen(false)
      return
    }
    const deep = event.metaKey || event.ctrlKey
    const unit = unitOf(chain, selection.inside, deep)
    const next = selection.ids.includes(unit.id) ? selection : picked(chain, selection, { shift: false, deep })
    const layers = togglable(view, next.ids)
    if (layers.length === 0) {
      chosen.current = []
      setOpen(false)
      return
    }
    chosen.current = layers
    applied.current = false
    point.current = { x: event.clientX, y: event.clientY }
    if (next !== selection) onSelection(next)
    const covered = layers.every((id) => propOf(view.nodes.get(id), "mask") === true)
    setLabel(covered ? editorCopy.removeMask : editorCopy.useAsMask)
    setOpen(true)
  }

  function apply() {
    if (applied.current) return
    applied.current = true
    const made = intentWrites(view, toggleIntents(view, chosen.current, "mask"))
    if (made !== null) client.push(made.writes)
    setOpen(false)
  }

  return (
    <div className="absolute inset-0" onContextMenu={onContextMenu}>
      {props.children}
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuContent anchor={anchor.current} finalFocus={false} data-keeps-selection data-layer-menu>
          <DropdownMenuItem
            onPointerDown={(event) => {
              if (event.button !== 0) return
              apply()
            }}
            onClick={apply}
          >
            {label}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
