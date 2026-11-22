import assert from "node:assert/strict"
import fs from "node:fs"
import { styleNames } from "./deck-templates/deck-parts.mjs"
import { blankTemplate, templateFile } from "../packages/templates/src/index.ts"
import { templateCatalog, templateDeck, templateSpecs, templateUrl } from "./deck-templates/build.mjs"

for (const spec of templateSpecs) {
  for (const start of [false, true]) {
    const file = templateUrl(spec.id, start)
    const bytes = templateDeck(spec, { start })
    assert.deepEqual(templateDeck(spec, { start }), bytes, `${file.pathname} is reproducible`)
    assert.deepEqual(fs.readFileSync(file), bytes, `${file.pathname} matches its generator`)
  }
}
console.log("template decks are reproducible")

assert.deepEqual(
  templateSpecs.map(({ id, name }) => ({ id, name })),
  templateCatalog,
  "the generator writes exactly the catalog's templates",
)
assert.ok(
  fs
    .readFileSync(new URL("../apps/web/src/decks/blank-deck.ts", import.meta.url), "utf8")
    .includes(`@airdesign/templates/${templateFile(blankTemplate, true)}`),
  "a new blank deck opens the blank template's start deck",
)
console.log("the catalog names every generated template and the blank deck's start file")

const layouts = ["Title Slide", "Section Header", "Title and Content", "Two Content", "Title Only", "Closing", "Blank"]
for (const spec of templateSpecs) {
  assert.deepEqual(
    spec.layouts.map((layout) => layout.name),
    layouts,
    `${spec.id} has every executive layout`,
  )
  assert.deepEqual(
    styleNames.map(([, name]) => name),
    ["Title", "Body", "Body 2", "Heading", "Caption", "Label", "Big number"],
  )
  for (const key of ["body", "body2", "body3", "subtitle"])
    assert.ok(spec.scale[key].size >= 14, `${spec.id} ${key} reads`)
  for (const key of ["caption", "label"]) assert.ok(spec.scale[key].size >= 9, `${spec.id} ${key} reads`)
}
console.log("each template has the executive layouts and a readable type scale")

const channels = (hex) => [0, 2, 4].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
const luminance = (hex) =>
  channels(hex)
    .map((value) => (value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, at) => sum + value * [0.2126, 0.7152, 0.0722][at], 0)
const contrast = (one, two) => {
  const [high, low] = [luminance(one), luminance(two)].sort((left, right) => right - left)
  return (high + 0.05) / (low + 0.05)
}
for (const spec of templateSpecs) {
  const { colors } = spec
  const background = spec.map === "dark" ? colors.dk1 : colors.lt1
  const text = spec.map === "dark" ? colors.lt1 : colors.dk1
  const accents = [1, 2, 3, 4, 5, 6].map((at) => colors[`accent${String(at)}`])
  assert.equal(new Set(accents).size, 6, `${spec.id} has six distinct accents`)
  assert.ok(contrast(text, background) >= 7, `${spec.id} text reads on its background`)
  assert.ok(contrast(colors.accent1, background) >= 4.5, `${spec.id} accent 1 reads as text`)
  if (spec.map === "dark") assert.ok(contrast(colors.lt2, background) >= 4.5, `${spec.id} muted text reads`)
}
console.log("each template's text, accent and muted colours read on its background")

const toHsl = (hex) => {
  const [red, green, blue] = channels(hex)
  const high = Math.max(red, green, blue)
  const low = Math.min(red, green, blue)
  const light = (high + low) / 2
  if (high === low) return [0, 0, light]
  const span = high - low
  const sat = light > 0.5 ? span / (2 - high - low) : span / (high + low)
  const hue =
    high === red
      ? (green - blue) / span + (green < blue ? 6 : 0)
      : high === green
        ? (blue - red) / span + 2
        : (red - green) / span + 4
  return [hue / 6, sat, light]
}
const fromHsl = ([hue, sat, light]) => {
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
  const p = 2 * light - q
  const part = (shift) => {
    const t = (hue + shift + 1) % 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [1 / 3, 0, -1 / 3]
    .map((shift) =>
      Math.round((sat === 0 ? light : part(shift)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
}
const resolveColor = (spec, written) => {
  const [name, ...transforms] = written.split(" ")
  const slots =
    spec.map === "dark"
      ? { tx1: "lt1", tx2: "lt2", bg1: "dk1", bg2: "dk2" }
      : { tx1: "dk1", tx2: "dk2", bg1: "lt1", bg2: "lt2" }
  const hex = spec.colors[slots[name] ?? name]
  const hsl = toHsl(hex)
  for (let at = 0; at < transforms.length; at += 2) {
    const amount = Number(transforms[at + 1]) / 100_000
    hsl[2] = transforms[at] === "lumMod" ? hsl[2] * amount : hsl[2] + amount
  }
  return fromHsl(hsl)
}
for (const spec of templateSpecs) {
  const slots = spec.map === "dark" ? ["dk1", "dk2"] : ["lt1", "lt2"]
  for (const [key, style] of Object.entries(spec.scale)) {
    const ink = resolveColor(spec, style.color)
    for (const slot of slots)
      assert.ok(
        contrast(ink, spec.colors[slot]) >= 4.5,
        `${spec.id} ${key} ${ink} reads on ${slot} (${contrast(ink, spec.colors[slot]).toFixed(2)})`,
      )
  }
}
console.log("every text style colour reads on both background colours")
