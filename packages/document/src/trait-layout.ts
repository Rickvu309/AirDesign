import { trait } from "./trait-decl.js"
import { alphaOver, choice, record, size } from "./value-kind.js"

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
  { version: 2, shape: "1094f216" },
  {
    flow: choice(flows),
    gap: size,
    padding: record({ left: size, top: size, right: size, bottom: size }),
    align: choice(layoutAligns),
    opacity: alphaOver("children"),
  },
)
