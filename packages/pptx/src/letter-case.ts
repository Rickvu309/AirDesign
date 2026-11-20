import type { TextCase, TextRun, TextValue } from "@airdesign/document"

export const capOf: Readonly<Record<TextCase, string>> = {
  none: "none",
  upper: "all",
  lower: "none",
  title: "none",
  small: "small",
}

const space = /\s/u
const letter = /\p{L}/u

function titled(text: string, afterSpace: boolean): string {
  let shown = ""
  let start = afterSpace
  for (const char of text) {
    shown += start && letter.test(char) ? char.toUpperCase() : char
    start = space.test(char)
  }
  return shown
}

function shown(run: TextRun, afterSpace: boolean): string {
  if (run.slideNumber !== undefined) return run.text
  if (run.case === "lower") return run.text.toLowerCase()
  if (run.case === "title") return titled(run.text, afterSpace)
  return run.text
}

export function shownLetters(value: TextValue): TextValue {
  return value.map((paragraph) => {
    let afterSpace = true
    const runs = paragraph.runs.map((run) => {
      const text = shown(run, afterSpace)
      if (run.text !== "") afterSpace = space.test(run.text.at(-1) ?? "")
      return text === run.text ? run : { ...run, text }
    })
    return runs.every((run, at) => run === paragraph.runs[at]) ? paragraph : { ...paragraph, runs }
  })
}
