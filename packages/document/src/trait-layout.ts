import { trait } from "./trait-decl.js"
import { alphaOver, choice, record, size } from "./value-kind.js"

export const flows = ["none", "horizontal", "vertical"] as const

export const sizings = ["hug", "fixed", "fill"] as const

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
  { version: 4, shape: "3bb2a4db" },
  {
    flow: choice(flows),
    gap: size,
    padding: record({ left: size, top: size, right: size, bottom: size }),
    align: choice(layoutAligns),
    opacity: alphaOver("children"),
    width: choice(sizings),
    height: choice(sizings),
  },
)
