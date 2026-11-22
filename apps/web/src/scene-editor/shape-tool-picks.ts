import type { Tool } from "./use-canvas-pointer"

export function toolForShape(geometry: string): Tool {
  if (geometry === "rect") return "rectangle"
  if (geometry === "ellipse") return "ellipse"
  if (geometry === "line") return "line"
  if (geometry === "straightConnector1") return "arrow"
  return `preset:${geometry}`
}
