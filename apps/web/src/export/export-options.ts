import type { SlideChoice } from "@/export/export-choice"

export type ExportFormat = "powerpoint" | "pdf"

export const exportCopy = {
  title: "Export",
  close: "Close",
  fileType: "File type",
  powerpoint: "PowerPoint",
  pdf: "PDF",
  slides: "Slides",
  allSlides: "All slides",
  currentSlide: "Current slide",
  range: "Range",
  selected: (count: number) => `${String(count)} selected slides`,
  from: "First slide",
  to: "Last slide",
  rangeOf: (count: number) => `Choose slides from 1 to ${count}, first slide before last.`,
  printWindow: "Your browser's print window opens next. Choose Save as PDF there.",
  action: "Export",
  exporting: "Exporting…",
  cancel: "Cancel",
  failed: "Unable to export. Your deck is unchanged.",
  tryAgain: "Try again",
} as const

export const formatNames: Record<ExportFormat, string> = {
  powerpoint: exportCopy.powerpoint,
  pdf: exportCopy.pdf,
}

export function slideNames(selected: number): Readonly<Partial<Record<SlideChoice, string>>> {
  const names = { all: exportCopy.allSlides, current: exportCopy.currentSlide, range: exportCopy.range }
  return selected > 1 ? { ...names, selected: exportCopy.selected(selected) } : names
}
