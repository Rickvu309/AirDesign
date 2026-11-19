import type { Desc, HasAlpha } from "@airdesign/document"

export type OpacityWire = HasAlpha extends true
  ? { readonly description: string; readonly desc: Desc; readonly example: { readonly opacity: number } }
  : null

export const opacityWire: OpacityWire = {
  description: "Percent, 0 invisible to 100 solid; fades fill, border and text together.",
  desc: { kind: "number", unit: "fraction", min: 0, max: 100_000 },
  example: { opacity: 60 },
}
