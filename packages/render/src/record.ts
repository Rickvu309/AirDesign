import type { ElementId, Kind, SlideId } from "@airdesign/document"
import type { FrameRecord } from "./frame-record.js"
import type { GroupRecord } from "./group-record.js"
import type { PictureRecord } from "./picture-record.js"
import type { PresetRecord } from "./preset-record.js"
import type { TableRecord } from "./table-kind.js"
import type { TextBoxRecord } from "./text-box-record.js"

export type {
  CanvasBullet,
  CanvasParagraph,
  CanvasRun,
  CanvasRunStyle,
  CanvasSpacing,
  CanvasText,
} from "./text-record.js"
export type { CanvasLine, CanvasOutline } from "./line-record.js"
export type { CanvasTable } from "./table-record.js"
export type { PaintBox } from "./paint-box.js"

export type ElementRecord = {
  readonly id: ElementId
  readonly kind: Kind
  readonly text: string
  readonly picture: string | null
}

export type SlideRecord = {
  readonly id: SlideId
  readonly elements: readonly ElementId[]
}

export type CanvasElement = TextBoxRecord | PictureRecord | PresetRecord | TableRecord | FrameRecord | GroupRecord

export type CanvasSlide = {
  readonly width: number
  readonly height: number
  readonly background: string | null
  readonly elements: readonly CanvasElement[]
}
