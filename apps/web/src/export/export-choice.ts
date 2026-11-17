import type { ExportFormat } from "@/export/export-options"
import { exportCopy } from "@/export/export-options"

export type SlideChoice = "all" | "current" | "range" | "selected"

export type ExportChoice = {
  readonly format: ExportFormat
  readonly slides: SlideChoice
  readonly from: string
  readonly to: string
}

export function firstChoice(count: number, selected: readonly number[] = []): ExportChoice {
  return { format: "powerpoint", slides: selected.length > 1 ? "selected" : "all", from: "1", to: String(count) }
}

function slideNumber(text: string, count: number): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const number = Number(trimmed)
  return number >= 1 && number <= count ? number : null
}

export function chosenSlides(
  choice: ExportChoice,
  count: number,
  current: number,
  selected: readonly number[] = [],
): readonly number[] | null | undefined {
  if (choice.slides === "all") return undefined
  if (choice.slides === "current") return [current]
  if (choice.slides === "selected")
    return selected.length === 0 ? [current] : [...selected].sort((left, right) => left - right)
  const from = slideNumber(choice.from, count)
  const to = slideNumber(choice.to, count)
  if (from === null || to === null || from > to) return null
  return Array.from({ length: to - from + 1 }, (_, offset) => from - 1 + offset)
}

export function rangeProblem(choice: ExportChoice, count: number): string | null {
  return chosenSlides(choice, count, 0) === null ? exportCopy.rangeOf(count) : null
}
