import { useElementFonts } from "./element-fonts.js"
import { useLayoutEffect, useRef, type ReactNode } from "react"
import type { ElementPaintProps } from "./element-host.js"
import { FrameArt } from "./frame-art.js"
import { GroupArt } from "./group-art.js"
import { PictureArt } from "./picture-art.js"
import { PresetArt } from "./preset-art.js"
import type { CanvasElement } from "./record.js"
import { TablePaint } from "./table-paint.js"
import { TextBoxArt } from "./text-box.js"

const textPreset = new Set(["rect", "roundRect", "ellipse"])

const painters = {
  text: TextBoxArt,
  picture: PictureArt,
  shape: PresetArt,
  table: TablePaint,
  frame: FrameArt,
  group: GroupArt,
} satisfies Record<string, (props: ElementPaintProps) => ReactNode>

export type ElementKind = keyof typeof painters

export function elementKind(element: CanvasElement): ElementKind {
  if (element.table !== undefined) return "table"
  if (element.kind === "picture") return "picture"
  if (element.kind === "chart" || element.kind === "kept") return "frame"
  if (element.kind === "connector") return "shape"
  if (element.kind === "group") return "group"
  if (element.geometry !== undefined && !textPreset.has(element.geometry.preset)) return "shape"
  return "text"
}

export function PaintedElement(props: ElementPaintProps & { readonly onPaint?: (() => void) | undefined }) {
  const ready = useElementFonts(props.element, props.store)
  const waited = useRef(!ready)
  useLayoutEffect(() => {
    if (!ready || !waited.current) return
    waited.current = false
    props.onPaint?.()
  }, [ready, props.onPaint])
  const Paint = painters[elementKind(props.element)]
  return (
    <>
      {ready ? null : <span data-fonts-pending="" hidden />}
      <Paint {...props} />
    </>
  )
}
