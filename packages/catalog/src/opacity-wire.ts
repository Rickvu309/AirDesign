import type { Desc } from "@airdesign/document"

export const opacityWire: { readonly desc: Desc } = {
  desc: { kind: "number", unit: "fraction", min: 0, max: 100_000 },
}
