import { catalogFamily } from "./catalog.js"

export const fontWeights = [
  { name: "Thin", weight: 100 },
  { name: "ExtraLight", weight: 200 },
  { name: "Light", weight: 300 },
  { name: "Regular", weight: 400 },
  { name: "Medium", weight: 500 },
  { name: "SemiBold", weight: 600 },
  { name: "Bold", weight: 700 },
  { name: "ExtraBold", weight: 800 },
  { name: "Black", weight: 900 },
] as const

export const regularWeight = 400
export const boldWeight = 700

export type NamedFace = {
  readonly family: string
  readonly typeface: string
  readonly name: string
  readonly weight: number
}

export type FontStyle = { readonly weight: number; readonly italic: boolean }

const faceSuffix = / (thin|extra ?light|light|medium|semi ?bold|extra ?bold|black)$/i

const named = (word: string) =>
  fontWeights.find((each) => each.name.toLowerCase() === word.replace(" ", "").toLowerCase())

export function namedFace(typeface: string): NamedFace | undefined {
  const suffix = faceSuffix.exec(typeface)
  if (suffix === null || catalogFamily(typeface) !== undefined) return undefined
  const family = catalogFamily(typeface.slice(0, suffix.index))
  const weight = named(suffix[1] ?? "")
  if (family === undefined || weight === undefined) return undefined
  return { family: family.family, typeface, name: weight.name, weight: weight.weight }
}

export function styleTypeface(family: string, weight: number): string {
  const name = fontWeights.find((each) => each.weight === weight)?.name
  return name === undefined || weight === regularWeight || weight === boldWeight ? family : `${family} ${name}`
}

export type ServedFace = { readonly style: string; readonly weight: string }

const italicName = "Italic"

export function styleName(style: FontStyle): string {
  const name = fontWeights.find((each) => each.weight === style.weight)?.name ?? "Regular"
  if (!style.italic) return name
  return style.weight === regularWeight ? italicName : `${name} ${italicName}`
}

export function readStyleName(text: string): FontStyle | undefined {
  if (text === italicName) return { weight: regularWeight, italic: true }
  const italic = text.endsWith(` ${italicName}`)
  const name = italic ? text.slice(0, -italicName.length - 1) : text
  const weight = fontWeights.find((each) => each.name === name)?.weight
  return weight === undefined ? undefined : { weight, italic }
}

export function holdsWeight(face: ServedFace, weight: number): boolean {
  const [low, high = low] = face.weight.split(" ").map(Number)
  return low !== undefined && high !== undefined && weight >= low && weight <= high
}

export function familyStyles(faces: readonly ServedFace[]): readonly FontStyle[] {
  const held = (weight: number, italic: boolean) =>
    faces.some((face) => (face.style === "italic") === italic && holdsWeight(face, weight))
  return fontWeights.flatMap(({ weight }) =>
    [false, true].filter((italic) => held(weight, italic)).map((italic) => ({ weight, italic })),
  )
}
