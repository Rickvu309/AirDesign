import type { ParagraphAlign, SchemeName, TextFormat } from "@airdesign/document"

export const formatCopy = {
  group: "Text format",
  named: { bold: "Bold", italic: "Italic", underline: "Underline", strike: "Strikethrough" },
  sizeGroup: "Font size",
  sizeMixed: "Font size, mixed",
  smaller: "Smaller",
  larger: "Larger",
  color: "Text color",
  colors: {
    dk1: "Dark 1",
    lt1: "Light 1",
    dk2: "Dark 2",
    lt2: "Light 2",
    accent1: "Accent 1",
    accent2: "Accent 2",
    accent3: "Accent 3",
    accent4: "Accent 4",
    accent5: "Accent 5",
    accent6: "Accent 6",
  },
  alignGroup: "Alignment",
  align: { left: "Align left", center: "Align center", right: "Align right" },
  bullets: "Bulleted list",
} as const satisfies {
  readonly group: string
  readonly named: Record<TextFormat, string>
  readonly sizeGroup: string
  readonly sizeMixed: string
  readonly smaller: string
  readonly larger: string
  readonly color: string
  readonly colors: Record<SchemeName, string>
  readonly alignGroup: string
  readonly align: Record<ParagraphAlign, string>
  readonly bullets: string
}
