import { trait } from "./trait-decl.js"
import { choice, record, size } from "./value-kind.js"

export const flows = ["none", "horizontal", "vertical"] as const

export const layoutAligns = [
  "topLeft",
  "top",
  "topRight",
  "left",
  "center",
  "right",
  "bottomLeft",
  "bottom",
  "bottomRight",
] as const

export const layout = trait(
  "own",
  { version: 1, shape: "8d73e44c" },
  {
    flow: choice(flows),
    gap: size,
    padding: record({ left: size, top: size, right: size, bottom: size }),
    align: choice(layoutAligns),
  },
)
