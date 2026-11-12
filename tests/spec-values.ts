import type { Phase } from "@airdesign/document"

type Spec = Record<string, boolean | number | string>

export function num(spec: Spec, key: string): number {
  const value = spec[key]
  if (typeof value !== "number") throw new Error(`${key} is not a number`)
  return value
}

export function flag(spec: Spec, key: string): boolean {
  const value = spec[key]
  if (typeof value !== "boolean") throw new Error(`${key} is not a boolean`)
  return value
}

export function text(spec: Spec, key: string): string {
  const value = spec[key]
  if (typeof value !== "string") throw new Error(`${key} is not text`)
  return value
}

export function phaseOf(spec: Spec): Phase {
  const phase = text(spec, "phase")
  if (phase === "idle" || phase === "running" || phase === "stopped" || phase === "undone") return phase
  throw new Error(`bad phase ${phase}`)
}
