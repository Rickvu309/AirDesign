type Size = { readonly cx: number; readonly cy: number }
type Adjust = Readonly<Record<string, number>>

const cornerDefaults: Readonly<Record<string, Adjust>> = {
  roundRect: { adj: 16_667 },
  round1Rect: { adj: 16_667 },
  round2SameRect: { adj1: 16_667, adj2: 0 },
}

const guideLimit = 2_147_483_647

export function keptCorners(preset: string, adjust: Adjust, before: Size, after: Size): Adjust | null {
  const defaults = Object.hasOwn(cornerDefaults, preset) ? cornerDefaults[preset] : undefined
  const from = Math.min(before.cx, before.cy)
  const to = Math.min(after.cx, after.cy)
  if (defaults === undefined || !(from > 0) || !(to > 0) || from === to) return null
  const kept = Object.entries(defaults).map(([name, standard]) => {
    const radius = (adjust[name] ?? standard) * from
    return [name, Math.min(guideLimit, Math.round(radius / to))] as const
  })
  return { ...adjust, ...Object.fromEntries(kept) }
}
