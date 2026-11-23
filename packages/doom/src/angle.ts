import { type Reader, finite } from "./read-kit.js"

export const wrapDegrees = (degrees: number): number => ((Math.round(degrees) % 360) + 360) % 360

const anyTurns = finite(-1e9, 1e9)

export const wrapRotation = (degrees: number): number => {
  const tenths = Math.round(degrees * 10)
  return (((tenths % 3600) + 3600) % 3600) / 10
}

export const readAngle: Reader<number> = (raw) => wrapDegrees(anyTurns(raw))

export const readRotation: Reader<number> = (raw) => wrapRotation(anyTurns(raw))
