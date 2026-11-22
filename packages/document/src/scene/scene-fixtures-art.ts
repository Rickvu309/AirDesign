import { type Text, type Theme, measureWith } from "./index.js"
import { textOf, theme } from "./sample-deck.js"
import type { TreeNode } from "./scene-tree.js"

export const plainTheme: Theme = {
  ...theme(),
  colors: {
    text: "#111111",
    background: "#ffffff",
    text2: "#666666",
    background2: "#eeeeee",
    accent1: "#0000ff",
    accent2: "#00ff00",
    accent3: "#ff0000",
    accent4: "#ffff00",
    accent5: "#00ffff",
    accent6: "#ff00ff",
    link: "#0000aa",
  },
  fonts: { heading: "Inter", body: "Inter" },
  textStyles: {
    ...theme().textStyles,
    body: { size: 20, font: "body", weight: 400, lineHeight: 1.5, tracking: 0 },
  },
}

export const swatches = {
  black: "#000000",
  custom: "#123456",
  halfBlue: "#8080ff",
  recoloured: "#abcdef",
  shown: "#112233",
  switchedOff: "#445566",
} as const

export const advance = 11
export const lineHeight = 30
export const measure = measureWith({})

export const spot = (x: number, y: number, w: number, h: number) => ({
  x,
  y,
  w,
  h,
  rotation: 0,
  flipH: false,
  flipV: false,
})

export const padding = (t: number, r = t, b = t, l = r) => ({ t, r, b, l })

export const row = (extra: object = {}, gap = 0, pad = padding(0), align = "top-left") => ({
  mode: "row" as const,
  gap,
  padding: pad,
  align: align as never,
  ...extra,
})

export const column = (extra: object = {}, gap = 0, pad = padding(0), align = "top-left") => ({
  mode: "column" as const,
  gap,
  padding: pad,
  align: align as never,
  ...extra,
})

export const block = (name: string, w: number, h: number, props: object = {}): TreeNode => ({
  type: "frame",
  name,
  props: { box: spot(0, 0, w, h), ...props },
})

export const words = (chars: string, extra: Partial<Text> = {}): Text => ({ ...textOf(chars), ...extra })

export const label = (name: string, chars: string, props: object = {}, text: Partial<Text> = {}): TreeNode => ({
  type: "shape",
  name,
  props: { box: spot(0, 0, 200, 100), text: words(chars, text), ...props },
})
