import type * as doom from "@airdesign/doom"
import type { Lift } from "./canvas-carry"
import type { CropGrip } from "./crop-drag"
import type { CropTarget } from "./crop-handles"
import type { EndGrip } from "./line-end-drag"
import type { Selection } from "./selection"
import type { Placed, Point, SlideGeometry } from "./slide-geometry"
import type { TransformGrip } from "./transform-math"

export type CanvasGesture =
  | { readonly kind: "pan"; readonly x: number; readonly y: number; readonly left: number; readonly top: number }
  | {
      readonly kind: "move"
      readonly origin: Point
      readonly ids: readonly doom.NodeId[]
      readonly view: doom.Doom
      readonly geometry: SlideGeometry
      readonly alone: Selection | null
      readonly selected: Selection
      copies: doom.Copies | null
      copying: boolean
      moved: boolean
      lifted: { readonly copies: doom.Copies | null; readonly lift: Lift | null } | null
      over: doom.NodeId | null | undefined
    }
  | {
      readonly kind: "transform"
      readonly grip: TransformGrip
      readonly origin: Point
      readonly ids: readonly doom.NodeId[]
      readonly view: doom.Doom
      readonly geometry: SlideGeometry
      moved: boolean
    }
  | {
      readonly kind: "end"
      readonly grip: EndGrip
      readonly origin: Point
      readonly line: doom.NodeId
      readonly view: doom.Doom
      readonly geometry: SlideGeometry
      moved: boolean
    }
  | {
      readonly kind: "crop"
      readonly grip: CropGrip
      readonly origin: Point
      readonly target: CropTarget
      readonly view: doom.Doom
      readonly geometry: SlideGeometry
      moved: boolean
    }
  | {
      readonly kind: "draw"
      readonly origin: Point
      readonly chain: readonly Placed[] | null
      moved: boolean
    }
  | {
      readonly kind: "marquee"
      readonly origin: Point
      readonly base: readonly doom.NodeId[]
      readonly before: Selection
      readonly blank: boolean
      readonly geometry: SlideGeometry
      readonly view: doom.Doom
      shown: string | null
      moved: boolean
    }

export type Moving = Extract<CanvasGesture, { kind: "move" }>
