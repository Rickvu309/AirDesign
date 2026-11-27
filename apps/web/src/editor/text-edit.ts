import * as doom from "@airdesign/doom"

export type Mark = "bold" | "italic" | "underline" | "strike"
export type Look = Omit<doom.Span, "end">
type Run = { readonly start: number; readonly end: number; readonly look: Look }
export type Base = { readonly font: string; readonly weight: number }

export function baseOf(text: doom.Text, theme: doom.Theme): Base {
  const style = theme.textStyles[text.style]
  return { font: doom.textFont(text, theme), weight: style.weight }
}

const lit = (look: Look, mark: Mark, base: Base): boolean =>
  mark === "bold" ? doom.paintedFace(look.font ?? base.font, base.weight, look.bold).bold : look[mark] === true

export function withMark(look: Look, mark: Mark, on: boolean, base: Base): Look {
  if (on) return { ...look, [mark]: true }
  const { [mark]: _was, ...rest } = look
  return lit(rest, mark, base) ? { ...rest, [mark]: false } : rest
}

const sameLook = (one: Look, two: Look): boolean => {
  const keys = new Set([...Object.keys(one), ...Object.keys(two)])
  return [...keys].every(
    (key) =>
      JSON.stringify((one as Record<string, unknown>)[key]) === JSON.stringify((two as Record<string, unknown>)[key]),
  )
}

function runsOf(text: Pick<doom.Text, "chars" | "spans">): readonly Run[] {
  if (text.chars.length === 0) return []
  if (text.spans.length === 0) return [{ start: 0, end: text.chars.length, look: {} }]
  let start = 0
  return text.spans.map((span) => {
    const { end, ...look } = span
    const run = { start, end, look }
    start = end
    return run
  })
}

function spansFrom(runs: readonly Run[]): doom.Span[] {
  const merged: Run[] = []
  for (const run of runs) {
    if (run.end <= run.start) continue
    const last = merged[merged.length - 1]
    if (last !== undefined && sameLook(last.look, run.look)) merged[merged.length - 1] = { ...last, end: run.end }
    else merged.push(run)
  }
  if (merged.every((run) => Object.keys(run.look).length === 0)) return []
  return merged.map((run) => ({ ...run.look, end: run.end }))
}

function lookBefore(runs: readonly Run[], offset: number): Look {
  const found =
    runs.find((run) => run.start < offset && offset <= run.end) ??
    runs.find((run) => run.start <= offset && offset < run.end)
  return found?.look ?? {}
}

function lookAfter(runs: readonly Run[], offset: number): Look {
  return runs.find((run) => run.start <= offset && offset < run.end)?.look ?? {}
}

const breaksIn = (chars: string): number => chars.split("\n").length - 1

export function replaceRange(text: doom.Text, from: number, to: number, insert: string, look?: Look): doom.Text {
  const low = Math.max(0, Math.min(from, to))
  const high = Math.min(text.chars.length, Math.max(from, to))
  const runs = runsOf(text)
  const carried = look ?? (low < high ? lookAfter(runs, low) : lookBefore(runs, low))
  const next: Run[] = [
    ...runs.flatMap((run) => (run.start < low ? [{ ...run, end: Math.min(run.end, low) }] : [])),
    { start: low, end: low + insert.length, look: carried },
    ...runs.flatMap((run) =>
      run.end > high
        ? [
            {
              ...run,
              start: Math.max(run.start, high) - high + low + insert.length,
              end: run.end - high + low + insert.length,
            },
          ]
        : [],
    ),
  ]
  const chars = text.chars.slice(0, low) + insert + text.chars.slice(high)
  const first = breaksIn(text.chars.slice(0, low))
  const removed = breaksIn(text.chars.slice(low, high))
  const added = breaksIn(insert)
  const source = text.paras[first] ?? {}
  const paras = [
    ...text.paras.slice(0, first + 1),
    ...Array.from({ length: added }, () => ({ ...source })),
    ...text.paras.slice(first + removed + 1),
  ]
  return { ...text, chars, spans: spansFrom(next), paras: paras.slice(0, breaksIn(chars) + 1) }
}

export function typeInto(
  text: doom.Text,
  from: number,
  to: number,
  insert: string,
  pending: Look | null,
): { readonly text: doom.Text; readonly pending: Look | null } {
  const next = replaceRange(text, from, to, insert, from === to ? (pending ?? undefined) : undefined)
  if (next.chars !== "") return { text: next, pending: null }
  return { text: next, pending: text.chars === "" ? pending : lookAt(text, Math.min(from, to)) }
}

export function toggleMark(text: doom.Text, from: number, to: number, mark: Mark, base: Base): doom.Text {
  const low = Math.min(from, to)
  const high = Math.max(from, to)
  if (low === high) return text
  const inside = runsOf(text).filter((run) => run.end > low && run.start < high)
  const on = inside.every((run) => lit(run.look, mark, base))
  const runs = runsOf(text).flatMap((run): Run[] => {
    if (run.end <= low || run.start >= high) return [run]
    const parts: Run[] = []
    if (run.start < low) parts.push({ start: run.start, end: low, look: run.look })
    parts.push({
      start: Math.max(run.start, low),
      end: Math.min(run.end, high),
      look: withMark(run.look, mark, !on, base),
    })
    if (run.end > high) parts.push({ start: high, end: run.end, look: run.look })
    return parts
  })
  return { ...text, spans: spansFrom(runs) }
}

export function markOn(text: doom.Text, from: number, to: number, mark: Mark, base: Base, pending?: Look): boolean {
  if (from === to) return lit(pending ?? lookBefore(runsOf(text), from), mark, base)
  const inside = runsOf(text).filter((run) => run.end > Math.min(from, to) && run.start < Math.max(from, to))
  return inside.length > 0 && inside.every((run) => lit(run.look, mark, base))
}

export type LinkedWords =
  | { readonly from: number; readonly to: number; readonly link: string | undefined; readonly mixed: false }
  | { readonly from: number; readonly to: number; readonly link: undefined; readonly mixed: true }

export function linkedWords(text: doom.Text, anchor: number, focus: number): LinkedWords | null {
  const [from, to] = [Math.min(anchor, focus), Math.max(anchor, focus)]
  const runs = runsOf(text)
  if (from < to) {
    const links = new Set(runs.filter((run) => run.end > from && run.start < to).map((run) => run.look.link))
    const [only] = links
    return links.size > 1 ? { from, to, link: undefined, mixed: true } : { from, to, link: only, mixed: false }
  }
  const at = runs.findIndex((run) => run.start < from && from <= run.end)
  const link = at === -1 ? undefined : runs[at]!.look.link
  if (link === undefined) return null
  let first = at
  let last = at
  while (runs[first - 1]?.look.link === link) first -= 1
  while (runs[last + 1]?.look.link === link) last += 1
  return { from: runs[first]!.start, to: runs[last]!.end, link, mixed: false }
}

export function linkWords(text: doom.Text, from: number, to: number, link: string | null): doom.Text {
  const runs = runsOf(text).flatMap((run): Run[] => {
    if (run.end <= from || run.start >= to) return [run]
    const { link: _was, ...rest } = run.look
    return [
      { start: run.start, end: from, look: run.look },
      { start: Math.max(run.start, from), end: Math.min(run.end, to), look: link === null ? rest : { ...rest, link } },
      { start: to, end: run.end, look: run.look },
    ]
  })
  return { ...text, spans: spansFrom(runs) }
}

export type TextSlice = {
  readonly chars: string
  readonly spans: readonly doom.Span[]
  readonly paras: readonly doom.Para[]
}

export function sliceText(text: doom.Text, from: number, to: number): TextSlice {
  const low = Math.max(0, Math.min(from, to))
  const high = Math.min(text.chars.length, Math.max(from, to))
  const chars = text.chars.slice(low, high)
  const runs = runsOf(text).flatMap((run): Run[] =>
    run.end > low && run.start < high
      ? [{ start: Math.max(run.start, low) - low, end: Math.min(run.end, high) - low, look: run.look }]
      : [],
  )
  const first = breaksIn(text.chars.slice(0, low))
  const last = breaksIn(text.chars.slice(0, high))
  return { chars, spans: spansFrom(runs), paras: text.paras.slice(first, last + 1) }
}

export function insertSlice(text: doom.Text, from: number, to: number, slice: TextSlice): doom.Text {
  const low = Math.max(0, Math.min(from, to))
  const high = Math.min(text.chars.length, Math.max(from, to))
  const runs = runsOf(text)
  const inserted = runsOf(slice).map((run) => ({
    start: run.start + low,
    end: run.end + low,
    look: run.look,
  }))
  const next: Run[] = [
    ...runs.flatMap((run) => (run.start < low ? [{ ...run, end: Math.min(run.end, low) }] : [])),
    ...inserted,
    ...runs.flatMap((run) =>
      run.end > high
        ? [
            {
              ...run,
              start: Math.max(run.start, high) - high + low + slice.chars.length,
              end: run.end - high + low + slice.chars.length,
            },
          ]
        : [],
    ),
  ]
  const chars = text.chars.slice(0, low) + slice.chars + text.chars.slice(high)
  const first = breaksIn(text.chars.slice(0, low))
  const removed = breaksIn(text.chars.slice(low, high))
  const added = breaksIn(slice.chars)
  const paras = [
    ...text.paras.slice(0, first + 1),
    ...Array.from({ length: added }, (_, at) => ({ ...(slice.paras[at + 1] ?? {}) })),
    ...text.paras.slice(first + removed + 1),
  ]
  return { ...text, chars, spans: spansFrom(next), paras: paras.slice(0, breaksIn(chars) + 1) }
}

export function filterSliceLinks(slice: TextSlice, keep: (link: string) => boolean): TextSlice {
  const runs = runsOf(slice).map((run) => {
    if (run.look.link === undefined || keep(run.look.link)) return run
    const { link: _was, ...rest } = run.look
    return { ...run, look: rest }
  })
  return { ...slice, spans: spansFrom(runs) }
}

export function lookAt(text: doom.Text, offset: number): Look {
  return lookBefore(runsOf(text), offset)
}

function paragraphsTouching(text: doom.Text, from: number, to: number): readonly number[] {
  const first = breaksIn(text.chars.slice(0, Math.min(from, to)))
  const last = breaksIn(text.chars.slice(0, Math.max(from, to)))
  return Array.from({ length: last - first + 1 }, (_, at) => first + at)
}

export function withParagraphs(
  text: doom.Text,
  from: number,
  to: number,
  change: (para: doom.Para) => doom.Para,
): doom.Text {
  const touched = new Set(paragraphsTouching(text, from, to))
  return { ...text, paras: text.paras.map((para, at) => (touched.has(at) ? change(para) : para)) }
}

export function toggledList(text: doom.Text, from: number, to: number, kind: "bullet" | "number"): doom.Text {
  const touched = paragraphsTouching(text, from, to)
  const on = touched.every((at) => text.paras[at]?.list === kind)
  return withParagraphs(text, from, to, (para) => {
    const { list: _list, level: _level, ...rest } = para
    return on ? rest : { ...rest, list: kind }
  })
}

export function graphemeBefore(chars: string, offset: number): number {
  if (offset <= 0) return 0
  const low = chars.charCodeAt(offset - 1)
  const high = chars.charCodeAt(offset - 2)
  return low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff ? offset - 2 : offset - 1
}

export function graphemeAfter(chars: string, offset: number): number {
  if (offset >= chars.length) return chars.length
  const high = chars.charCodeAt(offset)
  const low = chars.charCodeAt(offset + 1)
  return high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff ? offset + 2 : offset + 1
}

const wordChar = /[\p{L}\p{N}_]/u

export function wordBefore(chars: string, offset: number): number {
  let at = offset
  while (at > 0 && /\s/.test(chars[at - 1]!)) at -= 1
  const word = at > 0 && wordChar.test(chars[at - 1]!)
  while (at > 0 && !/\s/.test(chars[at - 1]!) && wordChar.test(chars[at - 1]!) === word) at -= 1
  return at
}

export function wordAfter(chars: string, offset: number): number {
  let at = offset
  while (at < chars.length && /\s/.test(chars[at]!)) at += 1
  const word = at < chars.length && wordChar.test(chars[at]!)
  while (at < chars.length && !/\s/.test(chars[at]!) && wordChar.test(chars[at]!) === word) at += 1
  return at
}
