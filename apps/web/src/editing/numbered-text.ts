import {
  readTextValue,
  shapeOf,
  shownSlideNumber,
  writeTextValue,
  type ElementId,
  type SlideNumbers,
} from "@airdesign/document"

export type NumberedText = (node: ElementId, stored: string) => string

export function numberedText(numbers: ReadonlyMap<string, SlideNumbers>): NumberedText {
  return (node, stored) => {
    const numbering = numbers.get(shapeOf(node).slide)
    if (numbering === undefined || !stored.includes('"slideNumber"')) return stored
    const text = readTextValue(stored)
    if (text === null) return stored
    return writeTextValue(
      text.map((paragraph) => ({
        ...paragraph,
        runs: paragraph.runs.map((run) => {
          if (run.slideNumber === undefined) return run
          const { number, suffix } = shownSlideNumber(run.slideNumber, numbering)
          return { ...run, text: number + suffix }
        }),
      })),
    )
  }
}
