import { exportCopy } from "@/copy/export-copy"
import { slideIndexOf } from "@/lib/slide-numbering"

export type SlideChoice = "all" | "current" | "range"

export type ExportChoice = {
  readonly slides: SlideChoice
  readonly from: string
  readonly to: string
}

export function firstChoice(count: number): ExportChoice {
  return { slides: "all", from: "1", to: String(count) }
}

function slideAt(text: string, count: number): number | null {
  const trimmed = text.trim()
  return /^\d+$/.test(trimmed) ? slideIndexOf(Number(trimmed), count) : null
}

export function chosenSlides(choice: ExportChoice, count: number, current: number): readonly number[] | null {
  if (choice.slides === "all") return Array.from({ length: count }, (_, at) => at)
  if (choice.slides === "current") return [current]
  const from = slideAt(choice.from, count)
  const to = slideAt(choice.to, count)
  if (from === null || to === null || from > to) return null
  return Array.from({ length: to - from + 1 }, (_, offset) => from + offset)
}

export function problemOn(choice: ExportChoice, count: number, skipped: readonly boolean[]): "range" | "slides" | null {
  if (choiceProblem(choice, count, skipped) === null) return null
  return chosenSlides(choice, count, 0) === null ? "range" : "slides"
}

export function choiceProblem(choice: ExportChoice, count: number, skipped: readonly boolean[]): string | null {
  const chosen = chosenSlides(choice, count, 0)
  if (chosen === null) return exportCopy.rangeOf(count)
  if (choice.slides === "current" || !chosen.every((at) => skipped[at] === true)) return null
  return choice.slides === "all" ? exportCopy.allSkipped : exportCopy.rangeSkipped
}
