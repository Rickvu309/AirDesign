import assert from "node:assert/strict"
import fs from "node:fs"
import { blankDeck, blankParts } from "./pptx-fixtures/blank-deck.mjs"

const first = blankDeck()
assert.deepEqual(blankDeck(), first)
assert.ok(first.length < 32_768)
for (const file of ["scripts/pptx-fixtures/blank.pptx"]) {
  assert.deepEqual(fs.readFileSync(new URL(`../${file}`, import.meta.url)), first, file)
}
console.log("blank deck bytes are reproducible")

const theme = new TextDecoder().decode(blankParts().get("ppt/theme/theme1.xml"))
const slot = (name) => new RegExp(`<a:${name}><a:srgbClr val="([0-9A-F]{6})"/>`).exec(theme)?.[1]
const channels = (hex) => [0, 2, 4].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
const saturation = (hex) => {
  const values = channels(hex)
  const high = Math.max(...values)
  const low = Math.min(...values)
  const light = (high + low) / 2
  return high === low ? 0 : (high - low) / (1 - Math.abs(2 * light - 1))
}
const luminance = (hex) =>
  channels(hex)
    .map((value) => (value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, at) => sum + value * [0.2126, 0.7152, 0.0722][at], 0)
const accents = [1, 2, 3, 4, 5, 6].map((at) => slot(`accent${at}`))
assert.equal(new Set(accents).size, 6, "the blank theme's six accents differ")
for (const accent of accents) assert.ok(saturation(accent) >= 0.4, `accent ${accent} is a colour, not a grey`)
assert.ok(1.05 / (luminance(accents[0]) + 0.05) >= 4.5, "accent 1 reads as text on white")
console.log("the blank theme has six distinct accent colours")

const appParts = blankParts({ empty: true })
assert.equal(
  new TextDecoder().decode(appParts.get("ppt/slides/slide1.xml")).includes("<p:sp>"),
  false,
  "a new Blank deck has no elements",
)
assert.match(new TextDecoder().decode(appParts.get("ppt/slides/_rels/slide1.xml.rels")), /slideLayout6.xml/)
