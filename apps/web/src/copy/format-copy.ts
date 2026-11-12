import type { TextFormat } from "@airdesign/document"

export const formatCopy = {
  group: "Text format",
  named: { bold: "Bold", italic: "Italic", underline: "Underline" },
} as const satisfies { readonly group: string; readonly named: Record<TextFormat, string> }
