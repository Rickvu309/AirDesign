import type { ParagraphAlign, TextFormat } from "@airdesign/document"

export const formatCopy = {
  group: "Text format",
  named: { bold: "Bold", italic: "Italic", underline: "Underline", strike: "Strikethrough" },
  sizeGroup: "Font size",
  sizeMixed: "Font size, mixed",
  smaller: "Smaller",
  larger: "Larger",
  color: "Text color",
  alignGroup: "Alignment",
  align: { left: "Align left", center: "Align center", right: "Align right", justify: "Justify" },
  bullets: "Bulleted list",
} as const satisfies {
  readonly group: string
  readonly named: Record<TextFormat, string>
  readonly sizeGroup: string
  readonly sizeMixed: string
  readonly smaller: string
  readonly larger: string
  readonly color: string
  readonly alignGroup: string
  readonly align: Record<ParagraphAlign, string>
  readonly bullets: string
}
