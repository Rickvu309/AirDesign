import type { Px } from "./paint.js"
import type { Text } from "./text.js"
import type { Theme } from "./theme.js"

const letterWidths: readonly (readonly [RegExp, number])[] = [
  [/[ijl.,:;'!|]/, 0.24],
  [/[ft \-()[\]r/]/, 0.31],
  [/[mw]/, 0.83],
  [/[MW%]/, 0.9],
  [/[A-Z]/, 0.7],
  [/[0-9$a-z]/, 0.55],
]

const bulletIndent = 0.9
const levelIndent = 1
const bulletGap = 0.35
const boldWidening = 1.07
const boldWeight = 600

function wordWidth(word: string, upper: boolean): number {
  let total = 0
  for (const letter of upper ? word.toUpperCase() : word)
    total += letterWidths.find(([kind]) => kind.test(letter))?.[1] ?? 0.9
  return total
}

export function wrappedLines(chars: string, room: number, upper: boolean): number {
  const space = wordWidth(" ", upper)
  let lines = 1
  let used = 0
  for (const word of chars.split(/\s+/).filter((each) => each.length > 0)) {
    const wide = wordWidth(word, upper)
    const wanted = used === 0 ? wide : used + space + wide
    if (wanted <= room) {
      used = wanted
      continue
    }
    if (used > 0) lines += 1
    lines += Math.floor(Math.max(0, wide - 0.001) / room)
    used = wide % room || room
  }
  return lines
}

const emOf = (style: Theme["textStyles"][Text["style"]]) =>
  style.size * (style.weight >= boldWeight ? boldWidening : 1) + style.tracking

export function textHeight(text: Text, theme: Theme, width: Px): Px {
  const style = theme.textStyles[text.style]
  const em = emOf(style)
  const inner = width - (text.padding?.l ?? 0) - (text.padding?.r ?? 0)
  let total = (text.padding?.t ?? 0) + (text.padding?.b ?? 0)
  text.chars.split("\n").forEach((chars, at) => {
    const para = text.paras[at] ?? {}
    const indent = para.list === undefined ? 0 : style.size * (bulletIndent + (para.level ?? 0) * levelIndent)
    const room = Math.max(1, inner - indent) / em
    total += wrappedLines(chars, room, style.case === "upper") * style.size * (para.lineHeight ?? style.lineHeight)
    total += para.spaceAfter ?? (para.list === undefined ? 0 : style.size * bulletGap)
  })
  return total
}

export function widestLine(chars: readonly string[], theme: Theme, style: Text["style"]): Px {
  const size = theme.textStyles[style].size
  return Math.max(0, ...chars.map((each) => wordWidth(each, theme.textStyles[style].case === "upper") * size))
}

export function widestWord(chars: readonly string[], theme: Theme, style: Text["style"], bold = false): Px {
  const look = theme.textStyles[style]
  const upper = look.case === "upper"
  const em = emOf(look) * (bold && look.weight < boldWeight ? boldWidening : 1)
  const words = chars.flatMap((each) => each.split(/\s+/).filter((word) => word.length > 0))
  return Math.max(0, ...words.map((word) => wordWidth(word, upper) * em))
}

export function widestWhole(chars: readonly string[], theme: Theme, style: Text["style"]): Px {
  const look = theme.textStyles[style]
  const upper = look.case === "upper"
  return Math.max(0, ...chars.map((each) => wordWidth(each, upper) * emOf(look)))
}
