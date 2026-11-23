import { exportCopy } from "@/copy/export-copy"
import type { SlideChoice } from "@/export/export-choice"

export type ExportFormat = "pdf"

export const formatNames: Record<ExportFormat, string> = {
  pdf: exportCopy.pdf,
}

export const slideNames: Readonly<Record<SlideChoice, string>> = {
  all: exportCopy.allSlides,
  current: exportCopy.currentSlide,
  range: exportCopy.range,
}
