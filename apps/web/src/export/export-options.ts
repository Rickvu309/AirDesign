import { exportCopy } from "@/copy/export-copy"
import type { SlideChoice } from "@/export/export-choice"

export type ExportFormat = "powerpoint" | "pdf"

export const formatNames: Record<ExportFormat, string> = {
  powerpoint: exportCopy.powerpoint,
  pdf: exportCopy.pdf,
}

export function slideNames(selected: number): Readonly<Partial<Record<SlideChoice, string>>> {
  const names = { all: exportCopy.allSlides, current: exportCopy.currentSlide, range: exportCopy.range }
  return selected > 1 ? { ...names, selected: exportCopy.selected(selected) } : names
}
