import type { CanvasBullet } from "./record.js"

const letters = "abcdefghijklmnopqrstuvwxyz"
const romanPairs = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
] as const

function wrapped(scheme: string, body: string): string {
  if (scheme.endsWith("ParenBoth")) return `(${body})`
  if (scheme.endsWith("ParenR")) return `${body})`
  if (scheme.endsWith("Period")) return `${body}.`
  return body
}

function repeated(value: number, upper: boolean): string {
  const index = Math.max(value, 1) - 1
  const letter = letters[index % 26] ?? "a"
  const word = letter.repeat(Math.floor(index / 26) + 1)
  return upper ? word.toUpperCase() : word
}

function roman(value: number, upper: boolean): string {
  let left = Math.max(value, 1)
  let out = ""
  for (const [amount, glyph] of romanPairs) {
    while (left >= amount) {
      out += glyph
      left -= amount
    }
  }
  return upper ? out.toUpperCase() : out
}

function fullwidth(value: number): string {
  return String(Math.max(value, 0)).replace(/\d/g, (digit) => String.fromCodePoint(0xff10 + Number(digit)))
}

function circled(value: number): string {
  if (value >= 1 && value <= 20) return String.fromCodePoint(0x2460 + value - 1)
  if (value >= 21 && value <= 35) return String.fromCodePoint(0x3251 + value - 21)
  if (value >= 36 && value <= 50) return String.fromCodePoint(0x32b1 + value - 36)
  return String(value)
}

export function bulletLabel(bullet: CanvasBullet): string {
  if ("char" in bullet) return bullet.char
  const { autoNumber, number } = bullet
  if (autoNumber.startsWith("romanLc")) return wrapped(autoNumber, roman(number, false))
  if (autoNumber.startsWith("romanUc")) return wrapped(autoNumber, roman(number, true))
  if (autoNumber.startsWith("alphaLc")) return wrapped(autoNumber, repeated(number, false))
  if (autoNumber.startsWith("alphaUc")) return wrapped(autoNumber, repeated(number, true))
  if (autoNumber.startsWith("arabicDb")) return wrapped(autoNumber, fullwidth(number))
  if (autoNumber.startsWith("circleNum")) return circled(number)
  return wrapped(autoNumber, String(number))
}
