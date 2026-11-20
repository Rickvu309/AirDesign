import { route, type Spot } from "@airdesign/document"
import type { End } from "./connector-drag.js"
import { paintPlace } from "./connector-drag.js"
import { elementFrame } from "./element-host.js"
import type { PaintBox } from "./paint-box.js"
import type { CanvasElement } from "./record.js"
import { ShapeArt } from "./shape-art.js"
import type { Scaled } from "./text-look.js"

const turn = 60_000

export function liveLineBox(box: PaintBox, end: End, from: Spot, at: Spot): PaintBox {
  const place = end === "start" ? route(paintPlace(box), at, from) : route(paintPlace(box), from, at)
  return {
    x: place.box.x,
    y: place.box.y,
    width: place.box.cx,
    height: place.box.cy,
    rotation: place.rot / turn,
    flipH: place.flipH,
    flipV: place.flipV,
  }
}

export function ConnectorLiveLine(props: {
  readonly element: CanvasElement
  readonly box: PaintBox
  readonly end: End
  readonly from: Spot
  readonly at: Spot
  readonly scaled: Scaled
}) {
  const { element, box, end, from, at, scaled } = props
  const live = { ...element, box: liveLineBox(box, end, from, at) }
  return (
    <div
      aria-hidden
      data-connector-aim
      data-ends={[from.x, from.y, at.x, at.y].map((emu) => String(scaled(emu))).join(" ")}
      style={elementFrame(live, scaled, false, false)}
    >
      <ShapeArt element={live} scaled={scaled} />
    </div>
  )
}
