export type NumberUnit = "emu" | "angle" | "fraction" | "hundredth-point" | "count"

export type Desc =
  | { readonly kind: "number"; readonly unit: NumberUnit; readonly min: number; readonly max: number }
  | { readonly kind: "flag" }
  | { readonly kind: "choice"; readonly options: readonly string[] }
  | { readonly kind: "mark" }
  | { readonly kind: "color" }
  | { readonly kind: "record"; readonly fields: Readonly<Record<string, Desc>> }
  | { readonly kind: "union"; readonly cases: Readonly<Record<string, Desc>>; readonly plain: string | null }
  | { readonly kind: "list"; readonly item: Desc; readonly min: number; readonly max: number }
  | { readonly kind: "named"; readonly item: Desc; readonly max: number }
  | { readonly kind: "link" }

export function choiceDesc(options: readonly string[]): Desc {
  return { kind: "choice", options }
}
