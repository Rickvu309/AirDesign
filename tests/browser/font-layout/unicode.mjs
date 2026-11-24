import { readFile } from "node:fs/promises"
import { gunzipSync } from "node:zlib"
import bidiFactory from "bidi-js"

const bidi = bidiFactory()
const hex = (value) => Number.parseInt(value, 16)
const numbers = (field) => field.trim().split(/\s+/).map(Number)
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

async function readSuite(name, version, visit) {
  const file = new URL(`./unicode/${name}.txt.gz`, import.meta.url)
  const suite = gunzipSync(await readFile(file)).toString()
  const header = suite.split(/\r?\n/, 1)[0]
  if (header !== `# ${name}-${version}.txt`) throw new Error(`Unexpected Unicode data for ${name}`)
  const failures = []
  let cases = 0
  for (const [index, row] of suite.split("\n").entries()) {
    const data = row.replace(/#.*/u, "").trim()
    if (!data) continue
    cases++
    const failure = visit(data)
    if (failure) failures.push({ line: index + 1, data, ...failure })
  }
  return { name, cases, failures }
}

function checkBreaks(boundaries, allowFirst) {
  return (data) => {
    let text = ""
    const expected = []
    for (const token of data.split(/\s+/)) {
      if (token === "÷") expected.push(text.length)
      else if (token !== "×") text += String.fromCodePoint(hex(token))
    }
    const offsets = boundaries(text)
    const actual = allowFirst ? offsets : offsets.slice(1)
    if (!same(actual, expected)) return { expected, actual }
  }
}

function checkBidi(data) {
  const [codepoints, direction, level, levels, order] = data.split(";")
  const points = codepoints
    .trim()
    .split(/\s+/)
    .map((cp) => String.fromCodePoint(hex(cp)))
  const text = points.join("")
  const embedding = bidi.getEmbeddingLevels(text, ["ltr", "rtl", "auto"][Number(direction)])
  const starts = new Map()
  let offset = 0
  for (const [index, point] of points.entries()) {
    starts.set(offset, index)
    offset += point.length
  }
  const officialLevels = levels.trim().split(/\s+/)
  const retained = (index) => officialLevels[index] !== "x"
  const actual = {
    level: embedding.paragraphs[0].level,
    levels: [...starts.keys()].map((start, index) => (retained(index) ? String(embedding.levels[start]) : "x")),
    order: bidi
      .getReorderedIndices(text, embedding)
      .filter((index) => starts.has(index))
      .map((index) => starts.get(index))
      .filter(retained),
  }
  const expected = { level: Number(level), levels: officialLevels, order: numbers(order) }
  if (!same(actual, expected)) return { expected, actual }
}

export function unicodeResults(icu, version) {
  return Promise.all([
    readSuite("GraphemeBreakTest", version, checkBreaks(icu.graphemes, true)),
    readSuite(
      "LineBreakTest",
      version,
      checkBreaks((text) => icu.lines(text, "und"), false),
    ),
    readSuite("BidiCharacterTest", version, checkBidi),
  ])
}
