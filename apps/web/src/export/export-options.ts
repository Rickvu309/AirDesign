import { downloadedOf } from "@/copy/product-copy"

export type ExportFormat = "powerpoint" | "pdf"

export const exportCopy = {
  title: "Export",
  close: "Close",
  fileType: "File type",
  powerpoint: "PowerPoint",
  pdf: "PDF",
  slides: "Slides",
  allSlides: "All slides",
  quality: "Quality",
  standard: "Standard",
  action: "Export",
  downloaded: downloadedOf("Q3 Investor Update.pptx"),
  failed: "Unable to export. Your deck is unchanged.",
  tryAgain: "Try again",
} as const

export const exportOptions: Record<ExportFormat, { label: string; value: string }[]> = {
  powerpoint: [
    { label: exportCopy.fileType, value: exportCopy.powerpoint },
    { label: exportCopy.slides, value: exportCopy.allSlides },
  ],
  pdf: [
    { label: exportCopy.fileType, value: exportCopy.pdf },
    { label: exportCopy.slides, value: exportCopy.allSlides },
    { label: exportCopy.quality, value: exportCopy.standard },
  ],
}
