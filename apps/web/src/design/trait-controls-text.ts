import { formatCopy } from "@/copy/format-copy"
import { textCopy } from "@/copy/text-copy"
import type { TraitControls } from "./trait-controls"

export const textControls: TraitControls<"text"> = {
  section: textCopy.section,
  fields: {
    value: { label: textCopy.value },
    color: { label: formatCopy.color },
    size: { label: formatCopy.sizeGroup },
    font: { label: textCopy.font },
    bold: { label: formatCopy.named.bold },
    italic: { label: formatCopy.named.italic },
    underline: { label: formatCopy.named.underline },
    align: { label: formatCopy.alignGroup },
    list: { label: textCopy.list },
    strike: { label: formatCopy.named.strike },
    letterSpacing: { label: textCopy.letterSpacing },
    lineSpacing: { label: textCopy.lineSpacing },
    spaceBefore: { label: textCopy.spaceBefore },
    spaceAfter: { label: textCopy.spaceAfter },
  },
}
