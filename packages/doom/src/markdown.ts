import type { Para, Span, Text, TextStyleName } from "./text.js"

type Look = {
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly strike: boolean
  readonly link?: string
}
type Piece = { readonly text: string; readonly look: Look }
type Flag = "bold" | "italic"

const plain: Look = { bold: false, italic: false, underline: false, strike: false }
const listLine = /^( *)([-*+]|\d+\.) +(.*)$/
const escapable = /[!-/:-@[-`{-~ ]/
const maxLevel = 8

const isSpace = (char: string | undefined) => char !== undefined && /\s/.test(char)
const sameLook = (a: Look, b: Look) =>
  a.bold === b.bold &&
  a.italic === b.italic &&
  a.underline === b.underline &&
  a.strike === b.strike &&
  a.link === b.link

const flagsOf = (count: number): readonly Flag[] =>
  count === 1 ? ["italic"] : count === 2 ? ["bold"] : count === 3 ? ["bold", "italic"] : []

function runAt(source: string, at: number, mark: string): number {
  let end = at
  while (source[end] === mark) end += 1
  return end - at
}

const starRunAt = (source: string, at: number) => runAt(source, at, "*")

function markClosesLater(source: string, from: number, mark: string): boolean {
  for (let at = from; at < source.length; at += 1) {
    if (source[at] === "\\") at += 1
    else if (source[at] === mark) {
      const count = runAt(source, at, mark)
      if (count === 2 && !isSpace(source[at - 1])) return true
      at += count - 1
    }
  }
  return false
}

function closesLater(source: string, from: number, flag: Flag): boolean {
  for (let at = from; at < source.length; at += 1) {
    if (source[at] === "\\") at += 1
    else if (source[at] === "*") {
      const count = starRunAt(source, at)
      if (flagsOf(count).includes(flag) && !isSpace(source[at - 1])) return true
      at += count - 1
    }
  }
  return false
}

function linkAt(
  source: string,
  at: number,
): { readonly label: string; readonly url: string; readonly end: number } | undefined {
  let close = at + 1
  while (close < source.length && source[close] !== "]") close += source[close] === "\\" ? 2 : 1
  if (close >= source.length || close === at + 1 || source[close + 1] !== "(") return undefined
  let url = ""
  let cursor = close + 2
  while (cursor < source.length && source[cursor] !== ")" && !isSpace(source[cursor])) {
    if (source[cursor] === "\\" && cursor + 1 < source.length) cursor += 1
    url += source[cursor]
    cursor += 1
  }
  if (source[cursor] !== ")" || url === "") return undefined
  return { label: source.slice(at + 1, close), url, end: cursor + 1 }
}

function inline(source: string, base: Look): readonly Piece[] {
  const pieces: Piece[] = []
  let look = base
  const add = (text: string, as: Look) => {
    const last = pieces[pieces.length - 1]
    if (last !== undefined && sameLook(last.look, as)) pieces[pieces.length - 1] = { text: last.text + text, look: as }
    else pieces.push({ text, look: as })
  }
  let at = 0
  while (at < source.length) {
    const char = source[at] as string
    if (char === "\\" && at + 1 < source.length && escapable.test(source[at + 1] as string)) {
      add(source[at + 1] as string, look)
      at += 2
    } else if (char === "*") {
      const count = starRunAt(source, at)
      const after = at + count
      const flags = flagsOf(count)
      const opens = flags.filter((flag) => !look[flag])
      const closes = flags.filter((flag) => look[flag])
      const valid =
        flags.length > 0 &&
        (opens.length === 0 || (after < source.length && !isSpace(source[after]))) &&
        (closes.length === 0 || (at > 0 && !isSpace(source[at - 1]))) &&
        opens.every((flag) => closesLater(source, after, flag))
      if (valid)
        look = {
          ...look,
          bold: flags.includes("bold") ? !look.bold : look.bold,
          italic: flags.includes("italic") ? !look.italic : look.italic,
        }
      else add(source.slice(at, after), look)
      at = after
    } else if (char === "+" || char === "~") {
      const count = runAt(source, at, char)
      const after = at + count
      const flag = char === "+" ? "underline" : "strike"
      const pair = count === 2
      const opens =
        pair && !look[flag] && after < source.length && !isSpace(source[after]) && markClosesLater(source, after, char)
      const closes = pair && look[flag] && !isSpace(source[at - 1])
      if (opens || closes) look = { ...look, [flag]: !look[flag] }
      else add(source.slice(at, after), look)
      at = after
    } else if (char === "[") {
      const found = linkAt(source, at)
      if (found === undefined) {
        add(char, look)
        at += 1
      } else {
        for (const piece of inline(found.label, { ...look, link: found.url })) add(piece.text, piece.look)
        at = found.end
      }
    } else {
      add(char, look)
      at += 1
    }
  }
  return pieces
}

type Item = { readonly kind: "bullet" | "number"; readonly level: number }

function itemOf(line: string): Item | undefined {
  const found = listLine.exec(line)
  if (found === null) return undefined
  const level = Math.min(maxLevel, Math.floor((found[1]?.length ?? 0) / 2))
  return { kind: (found[2] as string).endsWith(".") ? "number" : "bullet", level }
}

function inLooseList(lines: readonly string[], at: number, blank: (line: string) => boolean): boolean {
  const before = lines.slice(0, at).findLast((line) => !blank(line))
  const after = lines.slice(at + 1).find((line) => !blank(line))
  const next = after === undefined ? undefined : itemOf(after)
  if (before === undefined || next === undefined || itemOf(before) === undefined) return false
  if (next.level > itemOf(before)!.level) return true
  const sibling = lines
    .slice(0, at)
    .map(itemOf)
    .findLast((item) => item !== undefined && item.level <= next.level)
  return sibling !== undefined && sibling.level === next.level && sibling.kind === next.kind
}

export function textFromMarkdown(markdown: string, style: TextStyleName): Text {
  const lines = markdown.replace(/\t/g, "  ").split(/\r?\n/)
  const blank = (line: string) => line.trim() === ""
  const first = lines.findIndex((line) => !blank(line))
  const last = lines.findLastIndex((line) => !blank(line))
  const kept = first < 0 ? [] : lines.slice(first, last + 1)
  const paras: Para[] = []
  const pieces: Piece[] = []
  for (const [at, line] of kept.entries()) {
    if (blank(line) && inLooseList(kept, at, blank)) continue
    const found = listLine.exec(line)
    const body = found === null ? line.trimStart() : (found[3] as string)
    const parsed = blank(line) ? [] : inline(body, plain)
    if (paras.length > 0) pieces.push({ text: "\n", look: plain })
    pieces.push(...parsed)
    const marker = found?.[2]
    const level = Math.min(maxLevel, Math.floor((found?.[1]?.length ?? 0) / 2))
    paras.push(
      marker === undefined
        ? {}
        : { list: marker.endsWith(".") ? "number" : "bullet", ...(level === 0 ? {} : { level }) },
    )
  }
  if (paras.length === 0) paras.push({})
  const spans: { end: number; bold?: true; italic?: true; underline?: true; strike?: true; link?: string }[] = []
  let end = 0
  for (const { text, look } of pieces) {
    end += text.length
    const last = spans[spans.length - 1]
    const same =
      last !== undefined &&
      (last.bold === true) === look.bold &&
      (last.italic === true) === look.italic &&
      (last.underline === true) === look.underline &&
      (last.strike === true) === look.strike &&
      last.link === look.link
    if (same) last.end = end
    else
      spans.push({
        end,
        ...(look.bold ? { bold: true as const } : {}),
        ...(look.italic ? { italic: true as const } : {}),
        ...(look.underline ? { underline: true as const } : {}),
        ...(look.strike ? { strike: true as const } : {}),
        ...(look.link === undefined ? {} : { link: look.link }),
      })
  }
  const styled = spans.some(
    (span) => span.bold || span.italic || span.underline || span.strike || span.link !== undefined,
  )
  return {
    chars: pieces.map((piece) => piece.text).join(""),
    spans: styled ? spans : [],
    paras,
    style,
    resize: "height",
    alignV: "top",
  }
}

const lookOf = (span: Span | undefined): Look => ({
  bold: span?.bold === true,
  italic: span?.italic === true,
  underline: span?.underline === true,
  strike: span?.strike === true,
  ...(span?.link === undefined ? {} : { link: span.link }),
})

const escapeWords = (words: string) => words.replace(/[\\*[\]+~]/g, (char) => `\\${char}`)
const escapeAddress = (address: string) => address.replace(/[\\)]/g, (char) => `\\${char}`)
const styled = (look: Look) => look.bold || look.italic || look.underline || look.strike || look.link !== undefined

function runsOf(text: Text, from: number, to: number): readonly Piece[] {
  const spans = text.spans.length === 0 ? [{ end: text.chars.length }] : text.spans
  const pieces: Piece[] = []
  let start = 0
  for (const span of spans) {
    const part = text.chars.slice(Math.max(start, from), Math.min(span.end, to))
    start = span.end
    if (part === "") continue
    const look = lookOf(span)
    const core = part.trim()
    if (!styled(look) || core === "") {
      pieces.push({ text: part, look: plain })
      continue
    }
    const lead = part.slice(0, part.indexOf(core))
    pieces.push(...(lead === "" ? [] : [{ text: lead, look: plain }]), { text: core, look })
    const trail = part.slice(lead.length + core.length)
    if (trail !== "") pieces.push({ text: trail, look: plain })
  }
  const merged: Piece[] = []
  for (const piece of pieces) {
    const last = merged[merged.length - 1]
    if (last !== undefined && sameLook(last.look, piece.look))
      merged[merged.length - 1] = { text: last.text + piece.text, look: piece.look }
    else merged.push(piece)
  }
  return merged
}

const starsOf = (look: Look) => (look.bold ? 2 : 0) + (look.italic ? 1 : 0)

function markerDelta(from: Look, to: Look): string {
  if (from.underline === to.underline && from.strike === to.strike) {
    const count = (from.bold === to.bold ? 0 : 2) + (from.italic === to.italic ? 0 : 1)
    return "*".repeat(count)
  }
  let out = "*".repeat(starsOf(from))
  if (from.strike && !to.strike) out += "~~"
  if (from.underline && !to.underline) out += "++"
  if (!from.underline && to.underline) out += "++"
  if (!from.strike && to.strike) out += "~~"
  return out + "*".repeat(starsOf(to))
}

function lineOf(text: Text, from: number, to: number): string {
  let out = ""
  let state = plain
  for (const { text: words, look } of runsOf(text, from, to)) {
    out += markerDelta(state, look)
    state = { bold: look.bold, italic: look.italic, underline: look.underline, strike: look.strike }
    out += look.link === undefined ? escapeWords(words) : `[${escapeWords(words)}](${escapeAddress(look.link)})`
  }
  return out + markerDelta(state, plain)
}

const asWords = (line: string) =>
  line
    .replace(/^(\s)/, "\\$1")
    .replace(/^([-+]) /, "\\$1 ")
    .replace(/^(\d+)\. /, "$1\\. ")

export function textToMarkdown(text: Text): string {
  const counters: number[] = []
  const lines: string[] = []
  let from = 0
  text.chars.split("\n").forEach((chars, at) => {
    const para = text.paras[at] ?? {}
    const body = lineOf(text, from, from + chars.length)
    from += chars.length + 1
    const level = para.level ?? 0
    counters.splice(para.list === undefined ? 0 : para.list === "number" ? level + 1 : level)
    const number = para.list === "number" ? (counters[level] = (counters[level] ?? 0) + 1) : 0
    const marker = para.list === undefined ? "" : `${"  ".repeat(level)}${para.list === "bullet" ? "-" : `${number}.`} `
    lines.push(body === "" ? "" : `${marker}${asWords(body)}`)
  })
  return lines.join("\n").trim() === "" ? "" : lines.join("\n")
}
