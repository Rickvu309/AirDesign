import { trait } from "./trait-decl.js"
import { alphaOver, choice, record, size } from "./value-kind.js"

export const flows = ["none", "horizontal", "vertical"] as const

export const sizings = ["hug", "fixed"] as const

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
  { version: 3, shape: "8af7d84b" },
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
