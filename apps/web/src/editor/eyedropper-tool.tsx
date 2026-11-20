import type { Color } from "@airdesign/document"
import { gestureFor } from "@airdesign/render"
import { useEffect, useRef, useState } from "react"
import { colorCopy } from "@/copy/color-copy"
import { changeDesign } from "@/design/design-change"
import { dropperOf, pickScreenColor } from "@/design/eyedropper"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { eyedropperChanges, hasEyedropperTarget } from "@/editor/eyedropper-changes"
import type { DesigningDeck } from "@/editor/live-design-panel"
import { onLayers, typing } from "@/editor/pointer-tool"
import { sampleSlideColor } from "@/editor/slide-color-sample"

export type EyedropperPreview = {
  readonly hex: string
  readonly x: number
  readonly y: number
}

export type EyedropperState = {
  readonly sampling: boolean
  readonly preview: EyedropperPreview | null
  readonly cancel: () => void
  readonly move: (x: number, y: number) => void
  readonly click: (x: number, y: number) => void
}

function activeSlide(): HTMLElement | null {
  const node = document.querySelector("[data-slide-paint]")
  return node instanceof HTMLElement && node.closest("[inert]") === null ? node : null
}

function dialogOpen(): boolean {
  return document.querySelector('[role="dialog"][data-open], [role="alertdialog"][data-open]') !== null
}

export function useEyedropper(
  working: boolean,
  canPick: () => boolean,
  onPick: (color: Color) => void,
): EyedropperState {
  const [sampling, setSampling] = useState(false)
  const [preview, setPreview] = useState<EyedropperPreview | null>(null)
  const abort = useRef<AbortController | null>(null)
  const latestCanPick = useRef(canPick)
  const latestPick = useRef(onPick)
  const activeRef = useRef(false)
  useEffect(() => {
    latestCanPick.current = canPick
    latestPick.current = onPick
  })

  function cancel() {
    abort.current?.abort()
    abort.current = null
    activeRef.current = false
    setSampling(false)
    setPreview(null)
  }

  function move(x: number, y: number) {
    const slide = activeSlide()
    if (slide === null) {
      setPreview(null)
      return
    }
    const hex = sampleSlideColor(slide, x, y)
    setPreview(hex === null ? null : { hex, x, y })
  }

  function click(x: number, y: number) {
    const slide = activeSlide()
    const hex = slide === null ? null : sampleSlideColor(slide, x, y)
    cancel()
    if (hex !== null) latestPick.current({ rgb: hex })
  }

  useEffect(() => {
    if (!working) {
      cancel()
      return
    }
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented) return
      const gesture = gestureFor(event, "element")
      if (activeRef.current) {
        if (gesture === "deselect" || gesture === "tool-eyedropper") {
          event.preventDefault()
          event.stopPropagation()
          cancel()
        }
        return
      }
      if (typing(event.target) || !onLayers(event.target)) return
      if (gesture !== "tool-eyedropper" || !editorOwnsKey(event) || dialogOpen()) return
      if (activeSlide() === null || !latestCanPick.current()) return
      event.preventDefault()
      const native = dropperOf()
      if (native !== undefined) {
        const controller = new AbortController()
        abort.current = controller
        activeRef.current = true
        void pickScreenColor(controller.signal).then((color) => {
          if (abort.current !== controller) return
          abort.current = null
          activeRef.current = false
          if (color !== null) latestPick.current(color)
        })
        return
      }
      activeRef.current = true
      setSampling(true)
    }
    window.addEventListener("keydown", onKey, true)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      cancel()
    }
  }, [working])

  return { sampling, preview, cancel, move, click }
}

export function useDeckEyedropper(deck: DesigningDeck, working: boolean): EyedropperState {
  const latest = useRef(deck)
  useEffect(() => {
    latest.current = deck
  })
  return useEyedropper(
    working,
    () => hasEyedropperTarget(latest.current),
    (color) => {
      if (eyedropperChanges(latest.current, color).length === 0) return
      changeDesign(latest.current, () => eyedropperChanges(latest.current, color))
    },
  )
}

const chipWidth = 112
const chipHeight = 36
const chipOffset = 16

export function SlideEyedropper({ state }: { readonly state: EyedropperState }) {
  if (!state.sampling) return null
  const preview = state.preview
  const left =
    preview === null
      ? 0
      : Math.min(preview.x + chipOffset, Math.max(chipOffset, window.innerWidth - chipWidth - chipOffset))
  const top =
    preview === null
      ? 0
      : Math.min(preview.y + chipOffset, Math.max(chipOffset, window.innerHeight - chipHeight - chipOffset))
  return (
    <div
      data-eyedropper-overlay=""
      aria-label={colorCopy.eyedropper}
      className="fixed inset-0 z-50 cursor-crosshair select-none"
      onPointerMove={(event) => state.move(event.clientX, event.clientY)}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (event.button !== 0) {
          state.cancel()
          return
        }
        state.click(event.clientX, event.clientY)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        state.cancel()
      }}
    >
      <div role="status" aria-live="polite" className="sr-only">
        {colorCopy.eyedropperHint}
      </div>
      {preview === null ? null : (
        <div
          data-eyedropper-preview=""
          aria-hidden="true"
          className="pointer-events-none fixed flex items-center gap-2 rounded-full bg-foreground px-2.5 py-1 text-[length:var(--type-caption)] font-medium text-white tabular-nums shadow-lg"
          style={{ left, top }}
        >
          <span
            data-eyedropper-swatch=""
            className="size-3.5 shrink-0 rounded-full shadow-[0_0_0_1px_var(--stage-hover)]"
            style={{ backgroundColor: colorCopy.hexName(preview.hex) }}
          />
          <span>{colorCopy.hexName(preview.hex)}</span>
        </div>
      )}
    </div>
  )
}
