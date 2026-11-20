import { useLayoutEffect, useRef, type RefObject } from "react"
import type { CanvasElement, PaintBox } from "./record.js"
import { textHeight } from "./text-fit.js"
import { hugs, type FitSize } from "./text-hug.js"
import type { Scaled } from "./text-look.js"

function frameChildSize(shown: HTMLElement, placed: CanvasElement, stored: PaintBox, unit: number): FitSize | null {
  const grows = placed.text?.fit?.kind === "grow"
  const measured = grows ? textHeight(shown, placed.measure !== undefined) : null
  if (grows && measured === null) return null
  const height = measured === null ? stored.height : Math.round(measured / unit)
  return { height }
}

function hugSize(painted: CanvasElement): FitSize | null {
  const { box, text } = painted
  if (box === null || text === null || !hugs(text)) return null
  const height = Math.round(box.height)
  return text.wrap ? { height } : { width: Math.round(box.width), height }
}

function sizeMoved(size: FitSize, stored: PaintBox, unit: number): boolean {
  const height = Math.abs(size.height - stored.height) * unit >= 1
  return height || (size.width !== undefined && Math.abs(size.width - stored.width) * unit >= 1)
}

export function useFitReport(
  layer: RefObject<HTMLDivElement | null>,
  placed: CanvasElement,
  painted: CanvasElement,
  scaled: Scaled,
  report: (size: FitSize) => void,
  place: (box: PaintBox) => void,
) {
  const reported = useRef<string | null>(null)
  const answered = useRef(false)
  useLayoutEffect(() => {
    const shown = layer.current
    const stored = placed.box
    const owed = placed.measure === "owed"
    if (!owed) answered.current = false
    const unit = scaled(1)
    if (shown === null || stored === null || unit <= 0) return
    const size = placed.inFrame === "auto" ? frameChildSize(shown, placed, stored, unit) : hugSize(painted)
    if (size === null) return
    const key = JSON.stringify(size)
    const answers = owed && !answered.current
    if (!answers && (!sizeMoved(size, stored, unit) || reported.current === key)) return
    answered.current = owed
    reported.current = key
    if (placed.inFrame === undefined && placed.group === undefined)
      place({ ...stored, width: size.width ?? stored.width, height: size.height })
    report(size)
  })
}
