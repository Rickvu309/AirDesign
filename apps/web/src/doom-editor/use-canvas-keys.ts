import * as doom from "@airdesign/doom"
import { arrowOf, gestureFor, releases } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { zoomKey, type ZoomKey } from "@/editor/canvas-zoom"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { deleteWrites } from "./delete-writes"
import { moveWrites } from "./move-writes"
import { holdsText, lockedIn } from "./node-props"
import { arranged } from "./arrange-keys"
import { allIn, noSelection, steppedOut, type Selection } from "./selection"
import type { SlideGeometry } from "./slide-geometry"
import type { Tool } from "./use-canvas-pointer"
import type { EditorClient } from "./use-doom-deck"

export type KeyArgs = {
  readonly client: EditorClient
  readonly view: doom.Doom
  readonly geometry: SlideGeometry
  readonly selection: Selection
  readonly slide: doom.NodeId
  readonly onSelection: (next: Selection) => void
  readonly onTool: (tool: Tool) => void
  readonly onZoom: (key: ZoomKey) => void
  readonly onSpace: (down: boolean) => void
  readonly cancelDrag: () => boolean
  readonly onEditText: (id: doom.NodeId) => void
  readonly onActions: () => void
}

const toolOf = {
  "tool-move": "move",
  "tool-hand": "hand",
  "tool-text": "text",
  "tool-frame": "frame",
  "tool-rectangle": "rectangle",
  "tool-ellipse": "ellipse",
  "tool-line": "line",
  "tool-arrow": "arrow",
} as const

const nudge = 1
const nudgeFar = 10

export function typing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select") !== null)
  )
}

export function useCanvasKeys(args: KeyArgs) {
  const latest = useRef(args)
  useEffect(() => {
    latest.current = args
  })
  useEffect(() => {
    function down(event: KeyboardEvent) {
      if (event.isComposing || typing(event.target) || !editorOwnsKey(event)) return
      const a = latest.current
      const zoom = zoomKey({
        key: event.key,
        code: event.code,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        field: false,
      })
      if (zoom !== null) {
        event.preventDefault()
        a.onZoom(zoom)
        return
      }
      const selected = a.selection.ids.length > 0
      const gesture =
        (selected ? gestureFor(event, "element") : null) ?? gestureFor(event, "editor") ?? gestureFor(event, "slide")
      if (gesture === null) return
      const handled = () => event.preventDefault()
      if (arranged(gesture, a)) {
        handled()
        return
      }
      if (gesture === "undo" || gesture === "redo") {
        handled()
        if (gesture === "undo") a.client.undo()
        else a.client.redo()
      } else if (gesture === "pan") {
        handled()
        a.onSpace(true)
      } else if (gesture in toolOf) {
        handled()
        a.onTool(toolOf[gesture as keyof typeof toolOf])
      } else if (gesture === "actions") {
        handled()
        a.onActions()
      } else if (gesture === "edit-text") {
        const [only] = a.selection.ids
        if (only === undefined || a.selection.ids.length !== 1 || !holdsText(a.view, only)) return
        handled()
        a.onEditText(only)
      } else if (gesture === "select-all") {
        handled()
        a.onSelection(allIn(a.geometry, a.selection, (id) => lockedIn(a.view, id)))
      } else if (gesture === "deselect") {
        handled()
        if (!a.cancelDrag()) a.onSelection(noSelection)
      } else if (gesture === "select-parent") {
        handled()
        a.onSelection(steppedOut(a.geometry, a.selection))
      } else if (gesture === "delete") {
        handled()
        const writes = deleteWrites(a.view, a.selection.ids)
        if (writes.length > 0) a.client.push(writes)
        a.onSelection(noSelection)
      } else if (gesture === "nudge" || gesture === "nudge-far") {
        const step = arrowOf(event.key)
        if (step === null) return
        handled()
        const by = gesture === "nudge" ? nudge : nudgeFar
        const writes = moveWrites(a.view, a.geometry, a.selection.ids, { x: step.x * by, y: step.y * by })
        if (writes.length > 0) a.client.push(writes)
      }
    }
    function up(event: KeyboardEvent) {
      if (releases(event, "pan")) latest.current.onSpace(false)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])
}
