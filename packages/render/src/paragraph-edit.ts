import {
  readTextValue,
  sameFormats,
  type Caret,
  type TextParagraph,
  type TextRun,
  type TextValue,
} from "@airdesign/document"

export type { Caret } from "@airdesign/document"

function joins(left: TextRun | undefined, right: TextRun | undefined): boolean {
  return left !== undefined && right !== undefined && left.from === right.from && sameFormats(left, right)
}

export function textValue(stored: string): TextValue {
  return readTextValue(stored) ?? [{ from: 0, runs: stored === "" ? [] : [{ from: 0, text: stored }] }]
}

export function paragraphText(paragraph: TextParagraph): string {
  return paragraph.runs.map((run) => run.text).join("")
}

function splitRuns(runs: readonly TextRun[], offset: number): readonly [TextRun[], TextRun[]] {
  const head: TextRun[] = []
  const tail: TextRun[] = []
  let start = 0
  for (const run of runs) {
    const end = start + run.text.length
    if (end <= offset) head.push(run)
    else if (start >= offset) tail.push(run)
    else {
      head.push({ ...run, text: run.text.slice(0, offset - start) })
      tail.push({ ...run, text: run.text.slice(offset - start) })
    }
    start = end
  }
  return [head, tail]
}

export function splitParagraph(value: TextValue, caret: Caret): TextValue {
  const paragraph = value[caret.paragraph]
  if (paragraph === undefined) return value
  const [head, tail] = splitRuns(paragraph.runs, caret.offset)
  return [
    ...value.slice(0, caret.paragraph),
    { ...paragraph, runs: head },
    { ...paragraph, runs: tail },
    ...value.slice(caret.paragraph + 1),
  ]
}

export function joinParagraph(value: TextValue, index: number): TextValue {
  const before = value[index - 1]
  const joined = value[index]
  if (before === undefined || joined === undefined) return value
  const runs = [...before.runs]
  for (const run of joined.runs) {
    const moved = { ...run, from: before.from === joined.from ? run.from : -1 }
    const last = runs.at(-1)
    if (last !== undefined && joins(last, moved)) runs[runs.length - 1] = { ...last, text: last.text + run.text }
    else runs.push(moved)
  }
  return [...value.slice(0, index - 1), { ...before, runs }, ...value.slice(index + 1)]
}

export function cutValue(value: TextValue, start: Caret, end: Caret): TextValue {
  const ended = splitParagraph(value, end)
  const started = splitParagraph(ended, start)
  const kept = [...started.slice(0, start.paragraph + 1), ...started.slice(end.paragraph + 2)]
  const joined = joinParagraph(kept, start.paragraph + 1)
  const paragraph = joined[start.paragraph]
  const cut = started[start.paragraph + 1]
  const anchor = cut?.runs[0]
  if (paragraph === undefined || paragraph.runs.length > 0 || anchor === undefined || cut?.from !== paragraph.from) {
    return joined
  }
  return [
    ...joined.slice(0, start.paragraph),
    { ...paragraph, runs: [{ ...anchor, text: "" }] },
    ...joined.slice(start.paragraph + 1),
  ]
}

export function insertLines(value: TextValue, caret: Caret, lines: readonly string[]): readonly [TextValue, Caret] {
  let next = value
  let at = caret
  lines.forEach((line, index) => {
    if (index > 0) {
      next = splitParagraph(next, at)
      at = { paragraph: at.paragraph + 1, offset: 0 }
    }
    const [head, tail] = splitRuns(next[at.paragraph]?.runs ?? [], at.offset)
    const paragraph = next[at.paragraph]
    if (paragraph === undefined || line === "") return
    const last = head.at(-1)
    const first = tail[0]
    const written =
      last === undefined
        ? first === undefined
          ? [{ from: -1, text: line }]
          : [{ ...first, text: line + first.text }, ...tail.slice(1)]
        : first !== undefined && joins(first, last)
          ? [...head.slice(0, -1), { ...last, text: last.text + line + first.text }, ...tail.slice(1)]
          : [...head.slice(0, -1), { ...last, text: last.text + line }, ...tail]
    next = [...next.slice(0, at.paragraph), { ...paragraph, runs: written }, ...next.slice(at.paragraph + 1)]
    at = { paragraph: at.paragraph, offset: at.offset + line.length }
  })
  return [next, at]
}

export function replaceSelection(
  value: TextValue,
  start: Caret,
  end: Caret,
  lines: readonly string[],
): readonly [TextValue, Caret] {
  if (start.paragraph === end.paragraph && start.offset === end.offset) return insertLines(value, start, lines)
  const anchor = splitRuns(value[start.paragraph]?.runs ?? [], start.offset)[1][0]
  const cut = cutValue(value, start, end)
  const paragraph = cut[start.paragraph]
  const line = lines[0] ?? ""
  if (anchor === undefined || paragraph === undefined || line === "") return insertLines(cut, start, lines)
  const [head, tail] = splitRuns(paragraph.runs, start.offset)
  if (joins(head.at(-1), anchor)) return insertLines(cut, start, lines)
  const first = tail[0]
  const emptied = first !== undefined && first.text === ""
  const rest = emptied ? tail.slice(1) : tail
  const written = joins(rest[0], anchor)
    ? [...head, { ...anchor, text: line + (rest[0]?.text ?? "") }, ...rest.slice(1)]
    : [...head, { ...anchor, text: line }, ...rest]
  const next = [...cut.slice(0, start.paragraph), { ...paragraph, runs: written }, ...cut.slice(start.paragraph + 1)]
  const at = { paragraph: start.paragraph, offset: start.offset + line.length }
  return lines.length === 1 ? [next, at] : insertLines(next, at, ["", ...lines.slice(1)])
}
