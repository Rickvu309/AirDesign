import type { CanvasChartLine, CanvasChartLook } from "./chart-record.js"

export type ChartBox = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

type Paint = { readonly fill: string | null; readonly line: CanvasChartLine | null }

export type ChartShape =
  | ({ readonly kind: "path"; readonly key: string; readonly d: string } & Paint)
  | ({ readonly kind: "rect"; readonly key: string; readonly box: ChartBox } & Paint)
  | ({
      readonly kind: "circle"
      readonly key: string
      readonly x: number
      readonly y: number
      readonly r: number
    } & Paint)
  | {
      readonly kind: "polyline"
      readonly key: string
      readonly points: readonly (readonly [number, number])[]
      readonly line: CanvasChartLine
    }
  | {
      readonly kind: "text"
      readonly key: string
      readonly x: number
      readonly y: number
      readonly lines: readonly string[]
      readonly anchor: "start" | "middle" | "end"
      readonly align: "top" | "middle" | "bottom"
      readonly look: CanvasChartLook
      readonly turn: number
    }

export const lineHeight = 1.2
const charWidth = 0.52

export function measure(text: string, look: CanvasChartLook): { readonly width: number; readonly height: number } {
  const lines = text.split("\n")
  return {
    width: Math.max(0, ...lines.map((line) => line.length)) * look.size * charWidth,
    height: lines.length * look.size * lineHeight,
  }
}

export function words(
  key: string,
  text: string,
  look: CanvasChartLook,
  at: { readonly x: number; readonly y: number },
  anchor: "start" | "middle" | "end",
  align: "top" | "middle" | "bottom",
  turn = 0,
): ChartShape {
  return { kind: "text", key, x: at.x, y: at.y, lines: text.split("\n"), anchor, align, look, turn }
}

export function wrapped(text: string, look: CanvasChartLook, width: number): string {
  const most = Math.max(1, Math.floor(width / (look.size * charWidth)))
  return text
    .split("\n")
    .flatMap((line) => {
      const lines: string[] = []
      let current = ""
      for (const word of line.split(" ").filter((part) => part !== "")) {
        const next = current === "" ? word : `${current} ${word}`
        if (next.length > most && current !== "") {
          lines.push(current)
          current = word
        } else current = next
      }
      lines.push(current)
      return lines
    })
    .join("\n")
}
