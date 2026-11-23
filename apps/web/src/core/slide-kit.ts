import * as doom from "@airdesign/doom"

type Color = doom.Color
type Node = doom.TreeNode
type Paint = doom.Paint
type Align9 = doom.Align9
type Given = NonNullable<doom.TreeNode["props"]>

export const margin = 120
export const contentWidth = 1680

export const ink: Color = { var: "text" }
export const quiet: Color = { var: "text2" }
export const white: Color = { var: "background" }
export const navy: Color = { var: "accent1" }
export const sky: Color = { var: "accent2" }
export const green: Color = { var: "accent3" }

export const solid = (color: Color, opacity?: number): Paint => ({
  kind: "solid",
  color,
  ...(opacity === undefined ? {} : { opacity }),
})

export const box = (x: number, y: number, w: number, h: number) => ({
  x,
  y,
  w,
  h,
  rotation: 0,
  flipH: false,
  flipV: false,
})

export const pad = (t: number, r = t, b = t, l = r) => ({ t, r, b, l })

export const rowOf = (gap: number, align: Align9 = "top-left", padding = pad(0)): doom.Layout => ({
  mode: "row",
  gap,
  padding,
  align,
})

export const columnOf = (gap: number, align: Align9 = "top-left", padding = pad(0)): doom.Layout => ({
  mode: "column",
  gap,
  padding,
  align,
})

export type Part = { readonly text: string; readonly bold?: boolean; readonly color?: Color; readonly size?: number }
type Look = {
  readonly style?: doom.TextStyleName
  readonly align?: "left" | "center" | "right"
  readonly color?: Color
  readonly bold?: boolean
  readonly size?: number
  readonly lineHeight?: number
}

export function textOf(parts: string | readonly Part[], look: Look = {}): doom.Text {
  const list: readonly Part[] = typeof parts === "string" ? [{ text: parts }] : parts
  const chars = list.map((part) => part.text).join("")
  let end = 0
  const spans = list.flatMap((part) => {
    end += part.text.length
    const color = part.color ?? look.color
    const bold = part.bold ?? look.bold
    const size = part.size ?? look.size
    return part.text.length === 0
      ? []
      : [
          {
            end,
            ...(color === undefined ? {} : { color }),
            ...(bold === undefined ? {} : { bold }),
            ...(size === undefined ? {} : { size }),
          },
        ]
  })
  const plain = spans.every((span) => Object.keys(span).length === 1)
  return {
    chars,
    spans: plain ? [] : spans,
    paras: chars.split("\n").map(() => ({
      ...(look.align === undefined ? {} : { align: look.align }),
      ...(look.lineHeight === undefined ? {} : { lineHeight: look.lineHeight }),
    })),
    style: look.style ?? "body",
    resize: "height",
    alignV: "top",
  }
}

export function copy(
  name: string,
  parts: string | readonly Part[],
  look: Look & { readonly width?: number; readonly x?: number; readonly y?: number } = {},
  props: Partial<doom.Props> = {},
): Node {
  return {
    type: "shape",
    name,
    props: {
      box: box(look.x ?? 0, look.y ?? 0, look.width ?? 400, 40),
      text: textOf(parts, look),
      ...(look.width === undefined ? { sizing: { w: "fill", h: "hug" } as const } : {}),
      ...props,
    },
  }
}

export const frame = (name: string, props: Given, children: readonly Node[] = []): Node => ({
  type: "frame",
  name,
  props,
  children,
})

export const shape = (name: string, props: Given): Node => ({ type: "shape", name, props })

export function slideTitle(chars: string): Node {
  return copy("title", chars, { style: "heading", x: margin, y: 104, width: contentWidth })
}

export function accentTick(): Node {
  return frame("tick", { box: box(margin, 72, 72, 8), fills: [solid(sky)], radius: 4 })
}

export function footer(source: string, page: string): readonly Node[] {
  return [
    copy("source", source, { style: "caption", color: quiet, x: margin, y: 996, width: 1300 }),
    copy("page", page, {
      style: "caption",
      color: quiet,
      align: "right",
      x: margin + contentWidth - 200,
      y: 996,
      width: 200,
    }),
  ]
}

export const edge: Paint = solid({ var: "text2", tint: 0.78 })

export const tile = (name: string, props: Partial<doom.Props>, children: readonly Node[]): Node =>
  frame(
    name,
    {
      fills: [solid(white)],
      strokes: [edge],
      stroke: { weight: 1.5, align: "inside", dash: "solid" },
      radius: 20,
      effects: "soft",
      layout: columnOf(14, "top-left", pad(36)),
      sizing: { w: "fill", h: "hug" },
      box: box(0, 0, 100, 100),
      ...props,
    },
    children,
  )

export const iconOf = (name: string, icon: string, size: number, color: Color, weight = 3): Node =>
  shape(name, {
    box: box(0, 0, size, size),
    geometry: { kind: "icon", name: `lucide/${icon}` },
    strokes: [solid(color)],
    stroke: { weight, align: "center", dash: "solid" },
  })
