import type { PartKey } from "./instance.js"

type ExpressionFinding =
  | { readonly kind: "focus-missing"; readonly unknown: readonly string[]; readonly available: readonly string[] }
  | { readonly kind: "many-series"; readonly count: number; readonly capacity: number }
  | { readonly kind: "flow-omitted"; readonly omitted: readonly number[] }
  | { readonly kind: "rounded-to-zero"; readonly value: number; readonly scale: number; readonly digits: number }
  | { readonly kind: "advice"; readonly code: string; readonly note: string }

export type ReportFinding = (finding: ExpressionFinding) => void

export type ComponentFinding = { readonly key: PartKey; readonly field: string } & (
  | ExpressionFinding
  | { readonly kind: "check"; readonly message: string }
  | { readonly kind: "notice"; readonly message: string }
  | {
      readonly kind: "text-fit"
      readonly size: number
      readonly neededWidth: number
      readonly availableWidth: number
      readonly thinned?: number
      readonly advice?: string
    }
  | {
      readonly kind: "text-overflow"
      readonly neededWidth: number
      readonly neededHeight: number
      readonly availableWidth: number
      readonly availableHeight: number
    }
  | {
      readonly kind: "outside-frame"
      readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
      readonly frame: { readonly w: number; readonly h: number }
    }
)

export type TextFitFinding = Extract<ComponentFinding, { kind: "text-fit" }>
export type TextOverflowFinding = Extract<ComponentFinding, { kind: "text-overflow" }>
