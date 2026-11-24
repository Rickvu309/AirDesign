import * as hb from "harfbuzzjs"
import bidiFactory from "bidi-js"

export const hbVersion = hb.versionString()
const bidi = bidiFactory()
const scripts = [
  "Latin",
  "Arabic",
  "Hebrew",
  "Han",
  "Hiragana",
  "Katakana",
  "Hangul",
  "Thai",
  "Devanagari",
  "Greek",
  "Myanmar",
  "Balinese",
  "Javanese",
  "Sundanese",
].map((name, index) => [
  ["Latn", "Arab", "Hebr", "Hani", "Hira", "Kana", "Hang", "Thai", "Deva", "Grek", "Mymr", "Bali", "Java", "Sund"][
    index
  ],
  new RegExp("\\p{Script=" + name + "}", "u"),
])
const ignorable = /\p{Default_Ignorable_Code_Point}/u
const emojiChar = /\p{Emoji}/u
const emojiDefault = /\p{Emoji_Presentation}/u
const emojiSequence = /\p{Extended_Pictographic}.*\u200D.*\p{Extended_Pictographic}|\u20E3/u
const textSelector = /\p{Emoji}\uFE0E/u
const emojiSelector = /\p{Emoji}\uFE0F/u
const variations = new Map()
const noOptionalLigatures = ["liga", "clig"].map((tag) => new hb.Feature(tag, 0, 0, 0xffffffff))
const measureBuffer = new hb.Buffer()
const scalePerPx = 65536
const contentEnd = (text, start, end) => start + text.slice(start, end).trimEnd().length

function cssWeight(descriptor, weight) {
  const [min, max = min] = descriptor.split(/\s+/).map(Number)
  return Math.max(min, Math.min(weight, max))
}

export class Faces {
  faces = new Map()
  load(id, bytes, weight) {
    const blob = new hb.Blob(bytes)
    const face = new hb.Face(blob)
    this.faces.set(id, { id, face, axes: face.getAxisInfos(), weight, instances: new Map() })
  }
  get(id, weight) {
    const entry = this.faces.get(id)
    if (!entry) throw new Error("Face not loaded " + id)
    const resolvedWeight = cssWeight(entry.weight, weight)
    let font = entry.instances.get(resolvedWeight)
    if (font) return font
    font = new hb.Font(entry.face)
    const axes = Object.entries({ wght: resolvedWeight, opsz: 32 }).filter(([tag]) => tag in entry.axes)
    font.setVariations(
      axes.map(([tag, value]) => {
        const key = tag + value
        if (!variations.has(key)) variations.set(key, new hb.Variation(tag, value))
        return variations.get(key)
      }),
    )
    entry.instances.set(resolvedWeight, font)
    return font
  }
}

function shape(font, input, start, end, run, lang, level, script, reportGlyphs = false) {
  const buffer = measureBuffer
  buffer.reset()
  buffer.addText(input, start, end - start)
  buffer.setDirection(level % 2 ? hb.Direction.RTL : hb.Direction.LTR)
  buffer.setLanguage(lang)
  if (script) buffer.setScript(script)
  buffer.guessSegmentProperties()
  const scale = Math.round(run.size * scalePerPx)
  font.setScale(scale, scale)
  hb.shape(font, buffer, run.tracking ? noOptionalLigatures : [])
  const positions = buffer.getGlyphPositions()
  const width = positions.reduce((width, pos) => width + pos.xAdvance, 0) / scalePerPx
  if (!reportGlyphs) return { width }
  return { width, glyphs: buffer.getGlyphInfos().map((info) => info.codepoint) }
}

function covered(font, cluster, run, lang) {
  const has = (points) => points.every((cp) => ignorable.test(cp) || font.nominalGlyph(cp.codePointAt(0)))
  if (has(cluster.points)) return true
  const composed = cluster.text.normalize("NFC")
  if (composed !== cluster.text && has([...composed])) return true
  if (cluster.points.length === 1) return false
  const probe = shape(font, cluster.text, 0, cluster.text.length, run, lang, cluster.level, cluster.script, true)
  return probe.glyphs.length > 0 && !probe.glyphs.includes(0)
}

export function plan(runs, lang, faces, graphemes) {
  const text = runs.map((run) => run.text).join("")
  const ends = graphemes(text)
  const clusters = ends.slice(0, -1).map((index, at) => ({ index, segment: text.slice(index, ends[at + 1]) }))
  const bidiLevels = bidi.getEmbeddingLevels(text, "ltr").levels
  let runIndex = 0
  let runEnd = runs[0]?.text.length ?? 0
  const items = []
  const missing = []
  let priorScript
  for (const cluster of clusters) {
    const start = cluster.index
    const end = start + cluster.segment.length
    while (start >= runEnd) {
      runIndex++
      runEnd += runs[runIndex].text.length
    }
    const run = runs[runIndex]
    const level = bidiLevels[start]
    const directly = scripts.find(([, regex]) => regex.test(cluster.segment))?.[0]
    const script = directly ?? priorScript
    if (directly) priorScript = directly
    const part = { start, end, run, runIndex, level, script, points: [...cluster.segment], text: cluster.segment }
    if (cluster.segment === "\n") {
      items.push(part)
      priorScript = undefined
      continue
    }
    const preferText = textSelector.test(part.text)
    const preferEmoji =
      !preferText && (emojiSelector.test(part.text) || emojiDefault.test(part.text) || emojiSequence.test(part.text))
    const emojiLike = preferEmoji || preferText || part.points.some((cp) => emojiChar.test(cp) && !/[0-9#*]/.test(cp))
    let ids = run.faces
    if (preferText) ids = ids.filter((id) => id !== "Emoji")
    if (preferEmoji && ids.includes("Emoji")) ids = ["Emoji", ...ids.filter((id) => id !== "Emoji")]
    let face
    if (part.points.every((cp) => ignorable.test(cp))) face = run.faces[0]
    if (face === undefined) {
      for (const id of ids) {
        const font = faces.get(id, run.weight)
        if (!covered(font, part, run, lang)) continue
        if (emojiLike && part.points.length > 1 && id === "Emoji") {
          const probe = shape(font, part.text, 0, part.text.length, run, lang, 0, undefined, true)
          if (probe.glyphs.includes(0)) continue
        }
        face = id
        break
      }
    }
    if (!face) missing.push({ start, end, text: part.text })
    items.push({ ...part, face: face ?? run.faces[0] })
  }
  for (let index = items.length - 1, next; index >= 0; index--) {
    const item = items[index]
    if (item.text === "\n") next = undefined
    else if (item.script) next = item.script
    else if (next) item.script = next
  }
  const paint = []
  for (const item of items) {
    const prev = paint.at(-1)
    if (prev && prev.face === item.face && prev.runIndex === item.runIndex && prev.end === item.start)
      prev.end = item.end
    else paint.push({ start: item.start, end: item.end, face: item.face, runIndex: item.runIndex })
  }
  return { text, items, paint, missing, lang }
}

export function lineWidth(layout, start, end, faces, { softHyphen = false } = {}) {
  const { text, items, lang } = layout
  end = contentEnd(text, start, end)
  let width = 0
  const part = text.slice(start, end)
  let pending
  function flush() {
    if (!pending) return
    const { from, to, run, level, script, face, count } = pending
    const font = faces.get(face, run.weight)
    width += shape(font, part, from - start, to - start, run, lang, level, script).width + count * (run.tracking ?? 0)
  }
  let low = 0
  let high = items.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (items[mid].end <= start) low = mid + 1
    else high = mid
  }
  for (let index = low; index < items.length; index++) {
    const item = items[index]
    if (item.start >= end) break
    const { run, level, script, face } = item
    if (!face) continue
    if (
      pending &&
      pending.run === run &&
      pending.face === face &&
      pending.level === level &&
      pending.script === script
    ) {
      pending.to = Math.min(end, item.end)
      pending.count += item.points.every((cp) => ignorable.test(cp)) ? 0 : 1
    } else {
      flush()
      pending = {
        from: Math.max(start, item.start),
        to: Math.min(end, item.end),
        run,
        level,
        script,
        face,
        count: item.points.every((cp) => ignorable.test(cp)) ? 0 : 1,
      }
    }
  }
  flush()
  if (softHyphen && text[end - 1] === "\u00AD" && pending) {
    const { face, run, level, script } = pending
    const font = faces.get(face, run.weight)
    const hyphen = font.nominalGlyph(0x2010) ? "‐" : "-"
    width += shape(font, hyphen, 0, 1, run, lang, level, script).width
  }
  return width
}

export function wrap(layout, faces, width, breakAt) {
  const { text, lang, items } = layout
  const rows = []
  const rangeEnds = new Set(items.map((item) => item.end))
  let offset = 0
  for (const paragraph of text.split("\n")) {
    const end = offset + paragraph.length
    const limits = [
      ...new Set([...breakAt(paragraph, lang).filter((n) => n > 0 && rangeEnds.has(offset + n)), paragraph.length]),
    ].sort((a, b) => a - b)
    const at = limits.map((limit) => offset + limit)
    const line = (a, b) => {
      const hyphen = b < end && text[b - 1] === "\u00AD"
      return { start: a, end: b, width: lineWidth(layout, a, b, faces, { softHyphen: hyphen }) }
    }
    let start = offset
    while (start < end) {
      let chosen
      for (const next of at) {
        if (next <= start) continue
        const candidate = line(start, next)
        if (candidate.width <= width + 1 / 128) chosen = candidate
        else {
          chosen ??= candidate
          break
        }
      }
      rows.push(chosen)
      start = chosen.end
    }
    if (paragraph.length === 0) rows.push({ start: offset, end: offset, width: 0 })
    offset = end + 1
  }
  return rows
}

export function historicalWidth(item, faces, model, graphemes) {
  const [run] = item.runs
  const ends = graphemes(run.text)
  const points =
    model === "cluster"
      ? ends.slice(0, -1).map((start, index) => run.text.slice(start, ends[index + 1]))
      : [...run.text]
  if (model === "estimate") return points.length * 0.55 * run.size

  const ids = model === "stack" || model === "cluster" ? run.faces : [run.faces[0]]
  const fonts = ids.map((id) => faces.get(id, run.weight))
  const buffer = new hb.Buffer()
  function shapeLegacy(font, text) {
    const entry = faces.faces.get(ids[fonts.indexOf(font)])
    font.setScale(entry.face.upem, entry.face.upem)
    buffer.clearContents()
    buffer.addText(text)
    buffer.guessSegmentProperties()
    hb.shape(font, buffer)
    return {
      holds: buffer.getGlyphInfos().every((glyph) => glyph.codepoint !== 0),
      width: buffer.getGlyphPositions().reduce((sum, position) => sum + position.xAdvance, 0) / entry.face.upem,
    }
  }

  const holder = (point) => fonts.find((font) => [...point].every((char) => shapeLegacy(font, char).holds))
  let width = 0
  let previous
  let previousFont
  let advanceBefore
  for (const point of points) {
    const selected = holder(point)
    const advance = shapeLegacy(selected ?? fonts[0], point).width
    width += advance
    if (previous && (model === "first" || (selected && selected === previousFont)))
      width += shapeLegacy(selected ?? fonts[0], previous + point).width - advanceBefore - advance
    previous = point
    previousFont = selected
    advanceBefore = advance
  }
  return width * run.size
}
