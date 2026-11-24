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
  readonly bold: boolean
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

const regularWeight = 400
const boldWeight = 700
const boldFromStyleWeight = 600
const wholeFamilies = new Set(["Archivo Black", "Love Light", "Shadows Into Light"])
const faceSuffix = / (thin|extra ?light|light|medium|semi ?bold|extra ?bold|black)$/i

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

export function familyOf(font: string): string {
  return namedWeight(font)?.family ?? font
}

export function paintedFace(font: string, styleWeight: number, bold: boolean | undefined): PaintedFace {
  const named = namedWeight(font)
  const family = named?.family ?? font
  if (bold !== true && named !== undefined) return { family, font, weight: named.weight, name: named.name, bold: false }
  const flagged = bold ?? styleWeight >= boldFromStyleWeight
  return flagged
    ? { family, font: family, weight: boldWeight, name: "Bold", bold: true }
    : { family, font: family, weight: regularWeight, name: "Regular", bold: false }
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
