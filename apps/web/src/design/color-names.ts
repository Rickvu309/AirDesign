import { colorNameCopy } from "../copy/color-name-copy"

type Lab = { readonly L: number; readonly a: number; readonly b: number }
type Tone = "light" | "base" | "dark"
type Family =
  | "black"
  | "white"
  | "grey"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink"
  | "brown"

type Word = {
  readonly name: string
  readonly family: Family
  readonly tone: Tone
  readonly neutral: boolean
  readonly lab: Lab
}

const chromaGate = 0.02
const lightnessTie = 1e-4

const words: readonly Word[] = [
  word(colorNameCopy.black, "000000", "black", "base", true),
  word(colorNameCopy.white, "FFFFFF", "white", "base", true),
  word(colorNameCopy.grey, "808080", "grey", "base", true),
  word(colorNameCopy.lightGrey, "D0D0D0", "grey", "light", true),
  word(colorNameCopy.darkGrey, "646464", "grey", "dark", true),
  word(colorNameCopy.red, "E53935", "red", "base", false),
  word(colorNameCopy.lightRed, "FF8A80", "red", "light", false),
  word(colorNameCopy.darkRed, "C00000", "red", "dark", false),
  word(colorNameCopy.orange, "E07A2E", "orange", "base", false),
  word(colorNameCopy.lightOrange, "FFB74D", "orange", "light", false),
  word(colorNameCopy.darkOrange, "C45C12", "orange", "dark", false),
  word(colorNameCopy.yellow, "FFC000", "yellow", "base", false),
  word(colorNameCopy.lightYellow, "FFF176", "yellow", "light", false),
  word(colorNameCopy.darkYellow, "C69214", "yellow", "dark", false),
  word(colorNameCopy.green, "3D9B4A", "green", "base", false),
  word(colorNameCopy.lightGreen, "8FD14F", "green", "light", false),
  word(colorNameCopy.darkGreen, "1F7A32", "green", "dark", false),
  word(colorNameCopy.teal, "0E9A9A", "teal", "base", false),
  word(colorNameCopy.lightTeal, "4DB6AC", "teal", "light", false),
  word(colorNameCopy.darkTeal, "0B6E6E", "teal", "dark", false),
  word(colorNameCopy.blue, "4472C4", "blue", "base", false),
  word(colorNameCopy.lightBlue, "7EAFDC", "blue", "light", false),
  word(colorNameCopy.darkBlue, "2A2A80", "blue", "dark", false),
  word(colorNameCopy.purple, "7A4FC4", "purple", "base", false),
  word(colorNameCopy.lightPurple, "B39DDB", "purple", "light", false),
  word(colorNameCopy.darkPurple, "6B1248", "purple", "dark", false),
  word(colorNameCopy.pink, "EC407A", "pink", "base", false),
  word(colorNameCopy.lightPink, "F48FB1", "pink", "light", false),
  word(colorNameCopy.darkPink, "C2185B", "pink", "dark", false),
  word(colorNameCopy.brown, "8A3E12", "brown", "base", false),
  word(colorNameCopy.lightBrown, "E0A060", "brown", "light", false),
  word(colorNameCopy.darkBrown, "5C2E0C", "brown", "dark", false),
]

const byName = new Map(words.map((entry) => [entry.name, entry]))
const tones = new Map<Family, { light?: string; base?: string; dark?: string }>()
for (const entry of words) {
  const family = tones.get(entry.family) ?? {}
  family[entry.tone] = entry.name
  tones.set(entry.family, family)
}

function word(name: string, hex: string, family: Family, tone: Tone, neutral: boolean): Word {
  return { name, family, tone, neutral, lab: labOf(hex) }
}

function linear(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function labOf(hex: string): Lab {
  const [red, green, blue] = channels(hex).map(linear) as [number, number, number]
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue
  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)
  return {
    L: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  }
}

function channels(hex: string): readonly [number, number, number] {
  const digits = /#?([0-9A-Fa-f]{6})/.exec(hex)?.[1] ?? "000000"
  return [0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), 16)) as unknown as [number, number, number]
}

function chroma(lab: Lab): number {
  return Math.hypot(lab.a, lab.b)
}

function distance(left: Lab, right: Lab): number {
  return Math.hypot(left.L - right.L, left.a - right.a, left.b - right.b)
}

function namingDistance(lab: Lab, entry: Word): number {
  if (entry.tone !== "light" || entry.neutral) return distance(lab, entry.lab)
  const { L, a, b } = entry.lab
  const shade = 1 - L
  const strength = ((1 - lab.L) * shade + lab.a * a + lab.b * b) / (shade ** 2 + a ** 2 + b ** 2)
  const tint = Math.max(0, Math.min(1, strength))
  return distance(lab, { L: 1 - shade * tint, a: a * tint, b: b * tint })
}

function nearest(lab: Lab): Word {
  const neutral = chroma(lab) < chromaGate
  const pool = words.filter((entry) => entry.neutral === neutral)
  let best = pool[0] ?? words[0]
  let gap = best === undefined ? Infinity : namingDistance(lab, best)
  for (const entry of pool) {
    const next = namingDistance(lab, entry)
    if (next < gap) {
      best = entry
      gap = next
    }
  }
  return best ?? words[0]!
}

function free(names: readonly string[], indexes: readonly number[], candidate: string | undefined): boolean {
  if (candidate === undefined) return false
  const inside = new Set(indexes)
  return names.every((name, index) => inside.has(index) || name !== candidate)
}

function numberGroup(names: string[], indexes: readonly number[], labs: readonly Lab[], name: string): void {
  const reference = byName.get(name)?.lab
  const ranked = [...indexes].sort((left, right) => {
    const leftGap = reference === undefined ? 0 : distance(labs[left] ?? { L: 0, a: 0, b: 0 }, reference)
    const rightGap = reference === undefined ? 0 : distance(labs[right] ?? { L: 0, a: 0, b: 0 }, reference)
    return leftGap === rightGap ? left - right : leftGap - rightGap
  })
  const keeper = ranked[0]
  if (keeper === undefined) return
  const inside = new Set(indexes)
  const taken = new Set(names.filter((_, index) => !inside.has(index)))
  taken.add(name)
  names[keeper] = name
  let count = 2
  for (const index of indexes.filter((item) => item !== keeper).sort((left, right) => left - right)) {
    let next = colorNameCopy.numbered(name, count)
    while (taken.has(next)) {
      count += 1
      next = colorNameCopy.numbered(name, count)
    }
    names[index] = next
    taken.add(next)
    count += 1
  }
}

function distinguish(names: string[], labs: readonly Lab[], allowTone: boolean): void {
  const groups = new Map<string, number[]>()
  names.forEach((name, index) => {
    const list = groups.get(name)
    if (list === undefined) groups.set(name, [index])
    else list.push(index)
  })
  for (const [name, indexes] of groups) {
    if (indexes.length < 2) continue
    const entry = byName.get(name)
    const family = entry?.tone === "base" ? tones.get(entry.family) : undefined
    const levels = indexes.map((index) => labs[index]?.L ?? 0)
    const flat = Math.max(...levels) - Math.min(...levels) <= lightnessTie
    if (
      allowTone &&
      family?.light !== undefined &&
      family.dark !== undefined &&
      family.base !== undefined &&
      !flat &&
      free(names, indexes, family.light) &&
      free(names, indexes, family.dark)
    ) {
      const ordered = [...indexes].sort((left, right) => {
        const gap = (labs[right]?.L ?? 0) - (labs[left]?.L ?? 0)
        return gap === 0 ? left - right : gap
      })
      const lightest = ordered[0]
      const darkest = ordered[ordered.length - 1]
      if (lightest === undefined || darkest === undefined) continue
      if (ordered.length === 2) {
        names[lightest] = family.light
        names[darkest] = family.dark
      } else if (ordered.length === 3) {
        const middle = ordered[1]
        if (middle === undefined) continue
        names[lightest] = family.light
        names[middle] = family.base
        names[darkest] = family.dark
      } else {
        names[lightest] = family.light
        names[darkest] = family.dark
        for (const index of ordered.slice(1, -1)) names[index] = family.base
      }
      continue
    }
    numberGroup(names, indexes, labs, name)
  }
}

export function namedByColor<T extends { readonly css: string }>(
  swatches: readonly T[],
): (T & { readonly name: string })[] {
  const labs = swatches.map((swatch) => labOf(swatch.css))
  const names = labs.map((lab) => nearest(lab).name)
  distinguish(names, labs, true)
  distinguish(names, labs, false)
  return swatches.map((swatch, index) => ({ ...swatch, name: names[index] ?? colorNameCopy.black }))
}
