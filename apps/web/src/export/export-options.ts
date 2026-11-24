import { exportCopy } from "@/copy/export-copy"
import type { SlideChoice } from "@/export/export-choice"

export const slideNames: Readonly<Record<SlideChoice, string>> = {
  all: exportCopy.allSlides,
  current: exportCopy.currentSlide,
  range: exportCopy.range,
}
