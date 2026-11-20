import type { CSSProperties } from "react"
import type { CanvasText } from "./record.js"
import type { Scaled } from "./text-look.js"

export const anchored = { top: "flex-start", middle: "center", bottom: "flex-end" } as const

export function bodyLook(text: CanvasText, scaled: Scaled): CSSProperties {
  const whiteSpace = text.wrap ? "pre-wrap" : "pre"
  const columns = text.columns ?? 1
  if (columns > 1) {
    return {
      display: "block",
      flexShrink: 0,
      ...(text.overflow === true ? { columnFill: "balance" } : { maxBlockSize: "100%", columnFill: "auto" }),
      columnCount: columns,
      columnGap: `${scaled(text.columnGap ?? 0)}px`,
      whiteSpace,
    }
  }
  return {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    justifyContent: anchored[text.anchor],
    ...((text.flow ?? "horz") === "horz" ? { minHeight: "100%" } : { minBlockSize: "100%" }),
    whiteSpace,
  }
}

export const flowModes = {
  horz: {},
  vert: { writingMode: "vertical-rl", textOrientation: "sideways" },
  vert270: { writingMode: "sideways-lr" },
} as const satisfies Readonly<Record<NonNullable<CanvasText["flow"]>, CSSProperties>>
