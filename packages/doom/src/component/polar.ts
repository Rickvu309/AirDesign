import { object } from "../read-kit.js"
import { type Values, numeric } from "./values.js"

const readPoint = object({ x: numeric, y: numeric })

export function polar([origin, radius, turn]: Values): { readonly x: number; readonly y: number } {
  const center = readPoint(origin)
  const angle = (numeric(turn) % 1) * 2 * Math.PI
  const settle = (value: number) => Math.round(value * 1e6) / 1e6
  return {
    x: settle(center.x + numeric(radius) * Math.cos(angle)),
    y: settle(center.y + numeric(radius) * Math.sin(angle)),
  }
}
