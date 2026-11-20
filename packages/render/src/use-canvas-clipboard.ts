import type { Box, ElementId } from "@airdesign/document"
import { useEffect, useRef, type RefObject } from "react"
import { gestureFor } from "./gestures.js"
import type { Copied } from "./layer-copies.js"
import type { CanvasSlide } from "./record.js"
import type { Selection } from "./selection.js"
import type { OwnsKey } from "./use-slide-marquee.js"

export type PasteMode = "paste" | "over"

export type LayerPaste = {
  readonly mode: PasteMode
  readonly data: DataTransfer | null
  readonly selection: readonly ElementId[]
  readonly view: Box | null
}

export type LayerClipboard = {
  readonly copy: (ids: readonly ElementId[], data: DataTransfer, cut: boolean) => boolean
  readonly paste: (paste: LayerPaste) => Promise<readonly Copied[]> | null
}

const typingInto = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]'

const keyedModes = new Map<string, PasteMode>([["paste-over", "over"]])

function clipped(element: Element): boolean {
  const { overflowX, overflowY } = getComputedStyle(element)
  return overflowX !== "visible" || overflowY !== "visible"
}

export function viewOf(surface: HTMLElement, slide: CanvasSlide): Box | null {
  const own = surface.getBoundingClientRect()
  if (own.width <= 0 || own.height <= 0) return null
  let left = Math.max(own.left, 0)
  let top = Math.max(own.top, 0)
  let right = Math.min(own.right, window.innerWidth)
  let bottom = Math.min(own.bottom, window.innerHeight)
  for (let at = surface.parentElement; at !== null; at = at.parentElement) {
    if (!clipped(at)) continue
    const rect = at.getBoundingClientRect()
    left = Math.max(left, rect.left)
    top = Math.max(top, rect.top)
    right = Math.min(right, rect.right)
    bottom = Math.min(bottom, rect.bottom)
  }
  const scale = slide.width / own.width
  const emu = (px: number) => Math.round(px * scale)
  if (right <= left || bottom <= top) return null
  return { x: emu(left - own.left), y: emu(top - own.top), cx: emu(right - left), cy: emu(bottom - top) }
}

const served = "[data-layer-clipboard]"

function owned(target: EventTarget | null, surface: HTMLElement | null): boolean {
  if (surface === null || !(target instanceof Element)) return false
  if (target.closest(typingInto) !== null) return false
  return target === document.body || surface.contains(target) || target.closest(served) !== null
}

export function useCanvasClipboard(options: {
  readonly surface: RefObject<HTMLDivElement | null>
  readonly enabled: boolean
  readonly clipboard: LayerClipboard | undefined
  readonly slide: CanvasSlide
  readonly selection: RefObject<Selection>
  readonly paste: (made: Promise<readonly Copied[]>, from: HTMLElement | null) => void
  readonly ownsKey: OwnsKey | undefined
}) {
  const latest = useRef(options)
  latest.current = options
  const working = options.enabled && options.clipboard !== undefined
  useEffect(() => {
    if (!working) return
    function copied(event: ClipboardEvent) {
      const { surface, selection, clipboard } = latest.current
      const ids = selection.current.ids
      if (event.defaultPrevented || !owned(event.target, surface.current) || ids.length === 0) return
      if (event.clipboardData === null || clipboard === undefined) return
      if (clipboard.copy(ids, event.clipboardData, event.type === "cut")) event.preventDefault()
    }
    function pasted(mode: PasteMode, data: DataTransfer | null): boolean {
      const { surface, selection, slide, paste, clipboard } = latest.current
      const host = surface.current
      if (host === null || clipboard === undefined) return false
      const view = viewOf(host, slide)
      const made = clipboard.paste({ mode, data, selection: selection.current.ids, view })
      if (made === null) return false
      paste(made, host)
      return true
    }
    function pastedEvent(event: ClipboardEvent) {
      if (event.defaultPrevented || !owned(event.target, latest.current.surface.current)) return
      if (pasted("paste", event.clipboardData)) event.preventDefault()
    }
    function keyed(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.isComposing) return
      const mode = keyedModes.get(gestureFor(event, "editor") ?? "")
      if (mode === undefined || !owned(event.target, latest.current.surface.current)) return
      if (latest.current.ownsKey?.(event) === false) return
      event.preventDefault()
      pasted(mode, null)
    }
    document.addEventListener("copy", copied)
    document.addEventListener("cut", copied)
    document.addEventListener("paste", pastedEvent)
    document.addEventListener("keydown", keyed)
    return () => {
      document.removeEventListener("copy", copied)
      document.removeEventListener("cut", copied)
      document.removeEventListener("paste", pastedEvent)
      document.removeEventListener("keydown", keyed)
    }
  }, [working])
}
