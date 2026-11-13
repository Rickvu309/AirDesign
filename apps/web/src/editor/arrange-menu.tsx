import { stackTarget, type ElementId, type StackMove } from "@airdesign/document"
import { shapeSiblings } from "@airdesign/pptx"
import type { CanvasSlide } from "@airdesign/render"
import { useState, type MouseEvent, type ReactNode } from "react"
import type { CommitOutcome } from "@/commit-edit"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { arrangeCopy, arrangeMoves } from "@/copy/arrange-copy"

type MenuEvent = MouseEvent<HTMLDivElement> & { preventBaseUIHandler?: () => void }

function elementUnder(target: EventTarget | null, slide: CanvasSlide): ElementId | null {
  if (!(target instanceof Element)) return null
  const key = target.closest("[data-canvas-element]")?.getAttribute("data-canvas-element")
  if (key !== null && key !== undefined) {
    const found = slide.elements.find((each) => each.key === key)
    if (found?.id != null) return found.id
  }
  const selected = target.closest("[data-selection]")?.getAttribute("data-selection")
  if (selected === null || selected === undefined) return null
  const found = slide.elements.find((each) => each.id === selected)
  return found?.id ?? null
}

export function ArrangeMenu(props: {
  readonly className: string
  readonly slide: CanvasSlide
  readonly parts: ReadonlyMap<string, Uint8Array>
  readonly onOrder: (node: ElementId, move: StackMove) => Promise<CommitOutcome | "closed">
  readonly children: (band: {
    readonly notice: string
    readonly order: (node: ElementId, move: StackMove) => void
    readonly clear: () => void
  }) => ReactNode
}) {
  const [notice, setNotice] = useState("")
  const [node, setNode] = useState<ElementId | null>(null)
  const [among, setAmong] = useState<readonly ElementId[] | null>(null)

  function clear() {
    setNotice("")
  }

  function order(target: ElementId, move: StackMove) {
    setNotice("")
    void props.onOrder(target, move).then((outcome) => {
      if (outcome !== "refused" && outcome !== "closed") setNotice(arrangeCopy.said[move])
    })
  }

  function onContextMenu(event: MenuEvent) {
    const id = elementUnder(event.target, props.slide)
    if (id === null) {
      event.preventBaseUIHandler?.()
      setNode(null)
      setAmong(null)
      return
    }
    setNode(id)
    setAmong(shapeSiblings(props.parts, id))
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className={props.className} onContextMenu={onContextMenu}>
        {props.children({ notice, order, clear })}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {arrangeMoves.map((move) => (
          <ContextMenuItem
            key={move}
            disabled={node === null || among === null || stackTarget(among, node, move) === undefined}
            onClick={() => {
              if (node !== null) order(node, move)
            }}
          >
            <span>{arrangeCopy.label[move]}</span>
            <span className="ml-auto text-xs text-muted-foreground">{arrangeCopy.shortcut[move]}</span>
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}
