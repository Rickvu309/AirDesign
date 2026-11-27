import * as doom from "@airdesign/doom"
import { arrowOf, gestureFor, releases } from "@/lib/gestures"
import { useEffect, useRef } from "react"
import { zoomKey, type ZoomKey } from "@/editing/canvas-zoom"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { deleteWrites } from "./delete-writes"
import { moveWrites } from "./move-writes"
import { arranged } from "./arrange-keys"
import { allIn, noSelection, steppedIn, steppedOut, type Selection } from "./selection"
import type { SlideGeometry } from "@/editing/slide-geometry"
import type { Tool } from "./use-canvas-pointer"
import type { EditorClient } from "./use-deck"

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
  readonly dragging: () => boolean
  readonly onEditText: (id: doom.NodeId) => void
  readonly onActions: () => void
  readonly cropping: boolean
  readonly onCropEnd: () => void
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
      if (a.cropping && gestureFor(event, "crop") === "crop-end") {
        event.preventDefault()
        a.cancelDrag()
        a.onCropEnd()
        return
      }
      const [only] = a.selection.ids
      const parent = only !== undefined && a.selection.ids.length === 1 ? a.geometry.byId.get(only) : undefined
      const gesture =
        (parent?.children.length ? gestureFor(event, "container") : null) ??
        (only === undefined ? null : gestureFor(event, "element")) ??
        gestureFor(event, "editor") ??
        gestureFor(event, "slide")
      if (gesture === null) return
      const handled = () => event.preventDefault()
      if (arranged(gesture, a)) {
        handled()
        return
      }
      if (gesture === "undo" || gesture === "redo") {
        handled()
        if (a.dragging()) return
        if (gesture === "undo") a.client.undo()
        else a.client.redo()
      } else if (gesture === "pan") {
        if (event.target instanceof HTMLElement && event.target.closest("[data-view-toggle]") !== null) return
        handled()
        a.onSpace(true)
      } else if (gesture in toolOf) {
        handled()
        a.onTool(toolOf[gesture as keyof typeof toolOf])
      } else if (gesture === "actions") {
        handled()
        a.onActions()
      } else if (gesture === "edit-text" || gesture === "step-in") {
        if (event.target instanceof HTMLElement && event.target.closest("[data-view-toggle]") !== null) return
        if (gesture === "edit-text") {
          if (only === undefined || a.selection.ids.length !== 1 || !doom.holdsText(a.view, only)) return
          handled()
          a.onEditText(only)
        } else {
          if (event.target instanceof HTMLElement && event.target.closest("button, a") !== null) return
          const child = parent?.children.find(({ id }) => !doom.lockedIn(a.view, id))
          if (parent === undefined || child === undefined) return
          const inside = steppedIn([parent, child], a.selection)
          if (inside === null) return
          handled()
          a.onSelection(inside)
        }
      } else if (gesture === "select-all") {
        handled()
        a.onSelection(allIn(a.geometry, a.selection, (id) => doom.lockedIn(a.view, id)))
      } else if (gesture === "deselect") {
        handled()
        if (!a.cancelDrag()) a.onSelection(noSelection)
      } else if (gesture === "select-parent") {
        handled()
        a.onSelection(steppedOut(a.geometry, a.selection))
      } else if (gesture === "delete") {
        handled()
        if (a.dragging()) return
        const writes = deleteWrites(a.view, a.selection.ids)
        a.client.push(writes)
        a.onSelection(noSelection)
      } else if (gesture === "nudge" || gesture === "nudge-far") {
        const step = arrowOf(event.key)
        if (step === null) return
        handled()
        const by = gesture === "nudge" ? nudge : nudgeFar
        const writes = moveWrites(a.view, a.geometry, a.selection.ids, { x: step.x * by, y: step.y * by })
        a.client.push(writes)
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
