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
    }
)

export type TextFitFinding = Extract<ComponentFinding, { kind: "text-fit" }>
