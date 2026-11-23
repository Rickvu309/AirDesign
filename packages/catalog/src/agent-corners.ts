const emuPerPoint = 12_700

function tenths(value: number): number {
  return Math.round(value * 10) / 10
}

export const cornersAgents = { "geometry.corners": (value: number) => tenths(value / emuPerPoint) } as const
