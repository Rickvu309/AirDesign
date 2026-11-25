import { finite } from "../read-kit.js"
import type { Value } from "./values.js"

const nonnegative = finite(0, 1e15)

export function squareRoot(value: Value | undefined): number {
  return Math.sqrt(nonnegative(value))
}
