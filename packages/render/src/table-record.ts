import type { CanvasLine } from "./line-record.js"
import type { CanvasText } from "./text-record.js"

export type CanvasTable = {
  readonly columns: readonly number[]
  readonly rows: readonly {
    readonly height: number
    readonly cells: readonly {
      readonly gridSpan: number
      readonly rowSpan: number
      readonly hMerge: boolean
      readonly vMerge: boolean
      readonly fill: string | null
      readonly borders: Readonly<Record<"left" | "right" | "top" | "bottom", CanvasLine | null>>
      readonly text: CanvasText | null
    }[]
  }[]
}
