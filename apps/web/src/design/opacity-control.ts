import type { Desc } from "./control-desc"

export const opacitySteps = [100, 75, 50, 25, 10, 0] as const

export const opacityDesc: Desc = { kind: "number", unit: "fraction", min: 0, max: 100_000 }
