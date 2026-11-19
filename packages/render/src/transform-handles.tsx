import type { CSSProperties, PointerEvent } from "react"
import { corners, type Corner } from "./box-gesture.js"
import { edges, resizeCursor, rotateCursor, type Edge, type TransformGrip } from "./transform-math.js"

const handleSize = "var(--space-8)"
const rotateZone = 20

const gripped: CSSProperties = { position: "absolute", pointerEvents: "auto", touchAction: "none" }

const edgeStyles: Readonly<Record<Edge, CSSProperties>> = {
  top: { left: 0, top: 0, width: "100%", height: handleSize, transform: "translateY(-50%)" },
  right: { left: "100%", top: 0, width: handleSize, height: "100%", transform: "translateX(-50%)" },
  bottom: { left: 0, top: "100%", width: "100%", height: handleSize, transform: "translateY(-50%)" },
  left: { left: 0, top: 0, width: handleSize, height: "100%", transform: "translateX(-50%)" },
}

const cornerPositions: Readonly<Record<Corner, CSSProperties>> = {
  "top-left": { left: 0, top: 0 },
  "top-right": { left: "100%", top: 0 },
  "bottom-left": { left: 0, top: "100%" },
  "bottom-right": { left: "100%", top: "100%" },
}

const rotatePositions: Readonly<Record<Corner, CSSProperties>> = {
  "top-left": { left: 0, top: 0, width: rotateZone, height: rotateZone, transform: "translate(-16px, -16px)" },
  "top-right": { left: "100%", top: 0, width: rotateZone, height: rotateZone, transform: "translate(-4px, -16px)" },
  "bottom-left": { left: 0, top: "100%", width: rotateZone, height: rotateZone, transform: "translate(-16px, -4px)" },
  "bottom-right": {
    left: "100%",
    top: "100%",
    width: rotateZone,
    height: rotateZone,
    transform: "translate(-4px, -4px)",
  },
}

const cornerHandle: CSSProperties = {
  ...gripped,
  width: handleSize,
  height: handleSize,
  transform: "translate(-50%, -50%)",
  background: "var(--background)",
  boxShadow: "inset 0 0 0 1px var(--ring)",
}

export function TransformHandles(props: {
  readonly resizable: boolean
  readonly rotatable: boolean
  readonly rotation: number
  readonly onPress: (event: PointerEvent<HTMLElement>, grip: TransformGrip) => void
}) {
  const { onPress, resizable, rotatable, rotation } = props
  return (
    <>
      {rotatable
        ? corners.map((corner) => (
            <span
              key={`rotate-${corner}`}
              data-grip={`rotate-${corner}`}
              style={{ ...gripped, ...rotatePositions[corner], cursor: rotateCursor(corner, rotation) }}
              onPointerDown={(event) => onPress(event, `rotate-${corner}`)}
            />
          ))
        : null}
      {resizable
        ? edges.map((edge) => (
            <span
              key={edge}
              data-grip={edge}
              style={{ ...gripped, ...edgeStyles[edge], cursor: resizeCursor(edge, rotation) }}
              onPointerDown={(event) => onPress(event, edge)}
            />
          ))
        : null}
      {resizable
        ? corners.map((corner) => (
            <span
              key={corner}
              data-grip={corner}
              style={{ ...cornerHandle, ...cornerPositions[corner], cursor: resizeCursor(corner, rotation) }}
              onPointerDown={(event) => onPress(event, corner)}
            />
          ))
        : null}
    </>
  )
}
