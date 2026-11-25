import { object, reject } from "../read-kit.js"
import { type Charge, type Values, numeric } from "./values.js"

const sweepOverrun = 1e-9
const fullTurnGap = 1e-6
const readPoint = object({ x: numeric, y: numeric })
type Point = ReturnType<typeof readPoint>

const print = (value: number): string => String(Number(value.toFixed(10)))
const spot = ({ x, y }: Point): string => `${print(x)} ${print(y)}`

export function polyline(points: Values, charge: Charge): string {
  charge(points.length)
  if (points.length < 2) return reject("shape", "A polyline needs at least two points.")
  return points.map((point, i) => `${i === 0 ? "M" : "L"}${spot(readPoint(point))}`).join("")
}

export function wedge([origin, inner, outer, from, to]: Values, charge: Charge): string {
  charge(16)
  const center = readPoint(origin)
  const r0 = numeric(inner)
  const r1 = numeric(outer)
  const start = numeric(from)
  const end = numeric(to)
  const sweep = end - start
  if (r0 < 0 || r1 <= r0) return reject("shape", "Wedge radii must satisfy 0 ≤ inner < outer.")
  const turns = Math.abs(sweep)
  if (turns === 0 || turns > 1 + sweepOverrun) return reject("shape", "A wedge path must sweep up to one nonzero turn.")

  const at = (radius: number, turn: number): string => {
    const angle = (turn % 1) * (2 * Math.PI)
    return spot({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) })
  }
  const arc = (radius: number, turn: number, span: number): string =>
    `A${print(radius)} ${print(radius)} 0 ${Math.abs(span) > 0.5 ? 1 : 0} ${span > 0 ? 1 : 0} ${at(radius, turn)}`
  const circle = (radius: number, half: number) =>
    `M${at(radius, start)}${arc(radius, (start % 1) + half, half)}${arc(radius, start, half)}Z`

  if (turns >= 1 - fullTurnGap) {
    const half = Math.sign(sweep) / 2
    return circle(r1, half) + (r0 === 0 ? "" : circle(r0, -half))
  }
  const curved = (radius: number, from: number, to: number, span: number) => {
    if (turns <= 0.75) return arc(radius, to, span)
    const half = span / 2
    return arc(radius, (from % 1) + half, half) + arc(radius, to, half)
  }
  const outside = `M${at(r1, start)}${curved(r1, start, end, sweep)}`
  const inside = r0 === 0 ? `L${spot(center)}` : `L${at(r0, end)}${curved(r0, end, start, -sweep)}`
  return `${outside}${inside}Z`
}

export function discs(points: Values, rx: number, ry: number, charge: Charge): string {
  charge(points.length)
  const compact = (value: number) => String(Number(value.toFixed(6)))
  const radii = `${compact(rx)} ${compact(ry)}`
  return points
    .map((raw) => {
      const { x, y } = readPoint(raw)
      const a = `${compact(x - rx)} ${compact(y)}`
      const b = `${compact(x + rx)} ${compact(y)}`
      return `M${a}A${radii} 0 0 1 ${b}A${radii} 0 0 1 ${a}Z`
    })
    .join("")
}
