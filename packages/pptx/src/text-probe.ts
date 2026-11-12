import type { TextValue } from "@airdesign/document"

function plainText(text: string): boolean {
  if (text.length === 0) return false
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (code !== 9 && code !== 10 && code !== 13 && (code < 32 || code > 126)) return false
  }
  return true
}

const probeText = (text: string): string => (text === "AirDesignProbe" ? "AirDesignProbe2" : "AirDesignProbe")

export function probedValue(value: TextValue, runs: number): TextValue | null {
  for (const [at, paragraph] of value.entries()) {
    if (paragraph.runs.length < runs) continue
    const target = paragraph.runs.findIndex((run) => plainText(run.text))
    if (target < 0) continue
    const runsAfter = paragraph.runs.map((run, index) =>
      index === target ? { from: run.from, text: probeText(run.text) } : run,
    )
    return value.map((item, index) => (index === at ? { from: item.from, runs: runsAfter } : item))
  }
  return null
}
