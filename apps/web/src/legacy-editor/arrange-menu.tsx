import { stackTarget, type ElementId, type StackMove } from "@airdesign/document"
import { shapeSiblings } from "@airdesign/pptx"
import type { CanvasSlide, Selection } from "@airdesign/render"
import { useRef, useState, type MouseEvent, type ReactNode } from "react"
import type { CommitOutcome } from "@/editing/commit-edit"
import type { GroupChange } from "@/legacy-editor/group-actions"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { arrangeCopy, arrangeMoves, groupCopy } from "@/copy/arrange-copy"
import { maskAction } from "@/legacy-editor/mask-action"

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

function unitOf(slide: CanvasSlide, node: ElementId) {
  const found = slide.elements.find((each) => each.id === node)
  const top = found?.group?.id
  return (top === undefined ? found : slide.elements.find((each) => each.id === top)) ?? null
}

export function ArrangeMenu(props: {
  readonly className: string
  readonly slide: CanvasSlide
  readonly selection: Selection
  readonly parts: ReadonlyMap<string, Uint8Array>
  readonly onOrder: (node: ElementId, move: StackMove) => Promise<CommitOutcome | "closed">
  readonly onGroup: (change: GroupChange) => Promise<CommitOutcome | "closed">
  readonly onMask: (node: ElementId) => void
  readonly children: (band: {
    readonly notice: string
    readonly order: (node: ElementId, move: StackMove) => void
    readonly group: (change: GroupChange) => void
    readonly clear: () => void
  }) => ReactNode
}) {
  const [notice, setNotice] = useState("")
  const [node, setNode] = useState<ElementId | null>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const [among, setAmong] = useState<readonly ElementId[] | null>(null)
  const unit = node === null ? null : unitOf(props.slide, node)
  const masking = maskAction(props.selection.ids, props.slide.elements)
  const released =
    masking?.kind === "toggle" && props.slide.elements.some((each) => each.id === masking.node && each.mask === true)

  function clear() {
    setNotice("")
  }

  function order(target: ElementId, move: StackMove) {
    setNotice("")
    void props.onOrder(target, move).then((outcome) => {
      if (outcome !== "refused" && outcome !== "closed") setNotice(arrangeCopy.said[move])
    })
  }

  function group(change: GroupChange) {
    setNotice("")
    void props.onGroup(change).then((outcome) => {
      if (outcome !== "refused" && outcome !== "closed") setNotice(groupCopy.said[change.change])
    })
  }

  function giveBack(): boolean {
    const held = returnTo.current
    if (held === null || !held.isConnected) return true
    held.focus({ preventScroll: true })
    return false
  }

  function onContextMenu(event: MenuEvent) {
    const held = event.currentTarget.ownerDocument.activeElement
    returnTo.current = held instanceof HTMLElement && event.currentTarget.contains(held) ? held : null
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
        {props.children({ notice, order, group, clear })}
      </ContextMenuTrigger>
      <ContextMenuContent data-keeps-selection finalFocus={giveBack}>
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
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={props.selection.ids.length < 2}
          onClick={() => group({ change: "group", nodes: props.selection.ids })}
        >
          <span>{groupCopy.label.group}</span>
          <span className="ml-auto text-xs text-muted-foreground">{groupCopy.shortcut.group}</span>
        </ContextMenuItem>
        <ContextMenuItem
          data-group-action="plain-frame"
          disabled={props.selection.ids.length < 1}
          onClick={() => group({ change: "plain-frame", nodes: props.selection.ids })}
        >
          <span>{groupCopy.label["plain-frame"]}</span>
          <span className="ml-auto text-xs text-muted-foreground">{groupCopy.shortcut["plain-frame"]}</span>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={props.selection.ids.length < 1}
          onClick={() => group({ change: "frame", nodes: props.selection.ids })}
        >
          <span>{groupCopy.label.frame}</span>
          <span className="ml-auto text-xs text-muted-foreground">{groupCopy.shortcut.frame}</span>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={unit === null || unit.kind !== "group" || unit.id === null}
          onClick={() => {
            if (unit?.id != null) group({ change: "ungroup", node: unit.id })
          }}
        >
          <span>{groupCopy.label.ungroup}</span>
          <span className="ml-auto text-xs text-muted-foreground">{groupCopy.shortcut.ungroup}</span>
        </ContextMenuItem>
        <ContextMenuItem
          data-group-action="mask"
          disabled={masking === null}
          onClick={() => {
            if (masking?.kind === "group") group(masking.change)
            if (masking?.kind === "toggle") props.onMask(masking.node)
          }}
        >
          <span>{released ? groupCopy.release : groupCopy.label.mask}</span>
          <span className="ml-auto text-xs text-muted-foreground">{groupCopy.shortcut.mask}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
