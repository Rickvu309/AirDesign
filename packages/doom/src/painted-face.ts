export const weightNames = [
  "Thin",
  "ExtraLight",
  "Light",
  "Regular",
  "Medium",
  "SemiBold",
  "Bold",
  "ExtraBold",
  "Black",
] as const

export type WeightName = (typeof weightNames)[number]

export type PaintedFace = {
  readonly family: string
  readonly font: string
  readonly weight: number
  readonly name: WeightName
}

const weights: readonly { readonly name: WeightName; readonly weight: number }[] = [
  { name: "Thin", weight: 100 },
  { name: "ExtraLight", weight: 200 },
  { name: "Light", weight: 300 },
  { name: "Regular", weight: 400 },
  { name: "Medium", weight: 500 },
  { name: "SemiBold", weight: 600 },
  { name: "Bold", weight: 700 },
  { name: "ExtraBold", weight: 800 },
  { name: "Black", weight: 900 },
]

const steps = weights.map((each) => each.weight)
const regularWeight = 400
const boldWeight = 700
const wholeFamilies = new Set(["Archivo Black", "Love Light", "Shadows Into Light"])
const faceSuffix = / (thin|extra ?light|light|medium|semi ?bold|extra ?bold|black)$/i

function nearest(weight: number): number {
  let best = regularWeight
  let gap = Math.abs(regularWeight - weight)
  for (const each of weights) {
    const next = Math.abs(each.weight - weight)
    if (next < gap) {
      gap = next
      best = each.weight
    }
  }
  return best
}

function nameOf(weight: number): WeightName {
  return (
    weights.find((each) => each.weight === weight)?.name ??
    weights.find((each) => each.weight === nearest(weight))?.name ??
    "Regular"
  )
}

function namedWeight(
  font: string,
): { readonly family: string; readonly name: WeightName; readonly weight: number } | undefined {
  if (wholeFamilies.has(font)) return undefined
  const found = faceSuffix.exec(font)
  if (found === null) return undefined
  const word = (found[1] ?? "").replace(" ", "").toLowerCase()
  const match = weights.find((each) => each.name.toLowerCase() === word)
  if (match === undefined) return undefined
  const family = font.slice(0, found.index)
  return family.length === 0 ? undefined : { family, name: match.name, weight: match.weight }
}

export function boldWeightOf(held: readonly number[]): number {
  const near = held.filter((weight) => Math.abs(weight - boldWeight) <= 100)
  if (near.length === 0) return boldWeight
  return near.reduce((best, weight) => {
    const gap = Math.abs(weight - boldWeight)
    const bestGap = Math.abs(best - boldWeight)
    return gap < bestGap || (gap === bestGap && weight > best) ? weight : best
  })
}

export function paintedFace(
  font: string,
  styleWeight: number,
  bold: boolean | undefined,
  held: readonly number[] = steps,
): PaintedFace {
  const named = namedWeight(font)
  const family = named?.family ?? font
  if (bold === true) {
    const weight = boldWeightOf(held)
    const name = nameOf(weight)
    return weight === boldWeight
      ? { family, font: family, weight, name }
      : { family, font: `${family} ${name}`, weight, name }
  }
  const weight = named !== undefined ? named.weight : bold === false ? regularWeight : nearest(styleWeight)
  return { family, font: named !== undefined ? font : family, weight, name: named?.name ?? nameOf(weight) }
}

export function storedFace(
  family: string,
  weight: WeightName | number,
): { readonly font: string; readonly bold: boolean } {
  const value =
    typeof weight === "number" ? weight : (weights.find((each) => each.name === weight)?.weight ?? regularWeight)
  if (value === boldWeight) return { font: family, bold: true }
  const name = typeof weight === "string" ? weight : weights.find((each) => each.weight === value)?.name
  if (name === undefined || value === regularWeight) return { font: family, bold: false }
  return { font: `${family} ${name}`, bold: false }
}
