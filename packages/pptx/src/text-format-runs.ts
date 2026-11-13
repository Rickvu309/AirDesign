import { formatRange, type ParagraphAlign, type TextParagraph, type TextRun, type TextValue } from "@airdesign/document"
import { readShapes } from "./read-shapes.js"
import type { SlideRoute } from "./slide-route.js"

export const formatOperations = [
  "text.format",
  "text.format.range",
  "text.format.paragraphs",
  "text.size",
  "text.color",
  "text.align",
  "text.bullet",
] as const

type FormatOperation = (typeof formatOperations)[number]

const fileless = () => false

function lengthOf(paragraph: TextParagraph): number {
  return paragraph.runs.reduce((total, run) => total + run.text.length, 0)
}

function wholeFormat(value: TextValue): TextValue | null {
  if (!value.some((paragraph) => lengthOf(paragraph) > 0)) return null
  return value.map((paragraph) => ({
    from: paragraph.from,
    runs: paragraph.runs.map((run) => ({ ...run, bold: true, italic: false, underline: true })),
  }))
}

function rangeFormat(value: TextValue): TextValue | null {
  for (const [paragraph, item] of value.entries()) {
    let start = 0
    for (const run of item.runs) {
      if (run.text.length >= 3 && run.text !== "\n") {
        const range = {
          start: { paragraph, offset: start + 1 },
          end: { paragraph, offset: start + run.text.length - 1 },
        }
        return formatRange(value, range, "bold", true, fileless)
      }
      start += run.text.length
    }
  }
  return null
}

function paragraphsFormat(value: TextValue): TextValue | null {
  const lengths = value.map(lengthOf)
  const paragraph = lengths.findIndex((length, index) => length >= 2 && (lengths[index + 1] ?? 0) >= 2)
  if (paragraph < 0) return null
  const range = { start: { paragraph, offset: 1 }, end: { paragraph: paragraph + 1, offset: 1 } }
  return formatRange(formatRange(value, range, "underline", true, fileless), range, "italic", true, fileless)
}

function filled(value: TextValue): boolean {
  return value.some((paragraph) => lengthOf(paragraph) > 0)
}

function runsOf(paragraph: TextParagraph, run: (each: TextRun) => TextRun): TextParagraph {
  return { ...paragraph, runs: paragraph.runs.map(run) }
}

function sized(value: TextValue): TextValue | null {
  if (!filled(value)) return null
  return value.map((paragraph) => runsOf(paragraph, (run) => ({ ...run, size: 2750 })))
}

function colored(value: TextValue): TextValue | null {
  if (!filled(value)) return null
  return value.map((paragraph) => runsOf(paragraph, (run) => ({ ...run, color: { scheme: "accent2" } })))
}

function aligned(value: TextValue): TextValue | null {
  if (!filled(value)) return null
  const align: ParagraphAlign = "right"
  return value.map((paragraph) => ({ ...paragraph, align }))
}

function bulleted(value: TextValue): TextValue | null {
  if (!filled(value)) return null
  return value.map((paragraph) => ({ ...paragraph, bullet: true }))
}

const builders: Readonly<Record<FormatOperation, (value: TextValue) => TextValue | null>> = {
  "text.format": wholeFormat,
  "text.format.range": rangeFormat,
  "text.format.paragraphs": paragraphsFormat,
  "text.size": sized,
  "text.color": colored,
  "text.align": aligned,
  "text.bullet": bulleted,
}

export function formatRuns<Run>(
  parts: ReadonlyMap<string, Uint8Array>,
  run: (operation: FormatOperation, route: SlideRoute) => Run,
): readonly Run[] {
  const hosts = readShapes(parts).filter((shape) => shape.kind === "p:sp" && !shape.locked && shape.grouped !== true)
  return formatOperations.flatMap((operation) => {
    for (const host of hosts) {
      const value = builders[operation](host.text)
      if (value !== null) return [run(operation, { name: "text", part: host.part, shape: host.shape, value })]
    }
    return []
  })
}
