import { applied, escaped, round, type Box, type DrawState, type Matrix, type Point } from "./metafile-state.js"

export type TextRun = {
  readonly reference: Point
  readonly text: string
  readonly advances: readonly number[] | null
  readonly opaque: Box | null
}

const cellShare = 0.85
const plainHeight = 12
const generic: Readonly<Record<number, string>> = { 0x10: "serif", 0x30: "monospace" }
const unprintable = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g

function family(face: string, pitch: number): string {
  const fallback = generic[pitch & 0xf0] ?? "sans-serif"
  const named = face.replaceAll("'", "").trim()
  return escaped(named === "" ? fallback : `'${named}', ${fallback}`)
}

export function textMarkup(run: TextRun, state: DrawState, matrix: Matrix): string {
  const text = run.text.replace(unprintable, "")
  if (text.trim() === "") return ""
  const { font, align } = state
  const em = font.height < 0 ? -font.height : font.height > 0 ? font.height * cellShare : plainHeight
  const size = em * Math.hypot(matrix[2], matrix[3])
  if (!(size > 0)) return ""
  const reference = (align & 1) === 1 ? state.at : run.reference
  const across = align & 6
  const down = align & 24
  const [x, y] = applied(matrix, reference)
  const characters = [...text]
  let places = `x="${round(x)}" y="${round(y)}"`
  let anchor = across === 6 ? "middle" : across === 2 ? "end" : "start"
  if (run.advances !== null && run.advances.length >= characters.length) {
    const advances = run.advances.slice(0, characters.length)
    const total = advances.reduce((sum, advance) => sum + advance, 0)
    let start = reference[0] - (across === 6 ? total / 2 : across === 2 ? total : 0)
    const spots: Point[] = []
    for (const advance of advances) {
      spots.push(applied(matrix, [start, reference[1]]))
      start += advance
    }
    places = `x="${spots.map((spot) => round(spot[0])).join(" ")}" y="${spots.map((spot) => round(spot[1])).join(" ")}"`
    anchor = "start"
  }
  const attributes = [
    places,
    `font-family="${family(font.face, font.family)}"`,
    `font-size="${round(size)}"`,
    `fill="${state.textColor}"`,
    font.weight > 0 && font.weight !== 400 ? `font-weight="${font.weight}"` : "",
    font.italic ? 'font-style="italic"' : "",
    anchor === "start" ? "" : `text-anchor="${anchor}"`,
    down === 0 ? 'dominant-baseline="text-before-edge"' : down === 8 ? 'dominant-baseline="text-after-edge"' : "",
    font.underline || font.strike
      ? `text-decoration="${font.underline ? "underline" : ""} ${font.strike ? "line-through" : ""}"`
      : "",
    font.escapement === 0 ? "" : `transform="rotate(${round(-font.escapement / 10)} ${round(x)} ${round(y)})"`,
    'xml:space="preserve"',
  ].filter((part) => part !== "")
  return `<text ${attributes.join(" ")}>${escaped(characters.join(""))}</text>`
}
