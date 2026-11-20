import type { ElementId } from "@airdesign/document"
import type { FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, RefObject } from "react"
import type { GuideBoard } from "./guide-layer.js"
import type { Copied, CopyBoard } from "./layer-copies.js"
import type { CanvasElement } from "./record.js"
import type { Selection } from "./selection.js"
import type { HudChannel } from "./transform-hud.js"
import type { TransformGrip } from "./transform-math.js"

export type Moves = {
  readonly selection: Selection
  readonly guides: GuideBoard
  readonly latest: RefObject<Selection>
  readonly choose: (next: Selection) => void
  readonly isDragging: () => boolean
  readonly hud: HudChannel
  readonly copies: CopyBoard
  readonly paste: (made: Promise<readonly Copied[]>, from: HTMLElement | null) => void
  readonly message: string
  readonly say: (message: string) => void
  readonly select: (id: ElementId) => void
  readonly press: (event: PointerEvent<HTMLElement>, element: CanvasElement, grip: TransformGrip) => void
  readonly doubleClick: (event: MouseEvent<HTMLElement>, element: CanvasElement) => void
  readonly key: (event: KeyboardEvent<HTMLElement>, element: CanvasElement) => void
  readonly slide: {
    readonly onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
    readonly onFocus: (event: FocusEvent<HTMLDivElement>) => void
    readonly onBlur: (event: FocusEvent<HTMLDivElement>) => void
    readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
    readonly onKeyUp: (event: KeyboardEvent<HTMLDivElement>) => void
  }
}
