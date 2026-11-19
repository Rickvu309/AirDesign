import type { Box } from "@airdesign/document"
import { useSyncExternalStore } from "react"
import type { Scaled } from "./text-look.js"
import { formatAngleLabel, formatSizeLabel, visualBounds } from "./transform-math.js"

export type TransformHudState =
  | { readonly kind: "resize"; readonly frame: Box; readonly rotation: number }
  | { readonly kind: "rotate"; readonly frame: Box; readonly rotation: number; readonly displayAngle: number }

export type HudChannel = {
  readonly read: () => TransformHudState | null
  readonly write: (next: TransformHudState | null) => void
  readonly subscribe: (listener: () => void) => () => void
}

export function hudChannel(): HudChannel {
  let current: TransformHudState | null = null
  const listeners = new Set<() => void>()
  return {
    read: () => current,
    write(next) {
      if (current === next) return
      current = next
      for (const listener of Array.from(listeners)) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const pillOffset = 8

export function TransformHud(props: { readonly channel: HudChannel; readonly scaled: Scaled }) {
  const hud = useSyncExternalStore(props.channel.subscribe, props.channel.read, props.channel.read)
  if (hud === null) return null
  const bounds = visualBounds(hud.frame, hud.rotation)
  const text = hud.kind === "resize" ? formatSizeLabel(hud.frame.cx, hud.frame.cy) : formatAngleLabel(hud.displayAngle)
  return (
    <div
      data-transform-hud={hud.kind}
      aria-hidden
      style={{
        position: "absolute",
        left: props.scaled(bounds.x + bounds.cx / 2),
        top: props.scaled(bounds.y + bounds.cy) + pillOffset,
        transform: "translateX(-50%)",
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
        zIndex: 10,
        background: "var(--ring)",
        color: "var(--primary-foreground)",
        fontSize: "var(--panel-control-size)",
        lineHeight: "var(--panel-label-leading)",
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        padding: "0 var(--space-4)",
        borderRadius: "var(--shape-segment)",
      }}
    >
      {text}
    </div>
  )
}
