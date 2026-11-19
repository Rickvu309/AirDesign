import { formatCopy } from "@/copy/format-copy"
import { fillCopy } from "@/copy/fill-copy"
import { textCopy } from "@/copy/text-copy"
import type { TraitControls } from "./trait-controls"

export const textControls: TraitControls<"text"> = {
  section: textCopy.section,
  fields: {
    style: { label: textCopy.style },
    value: { label: textCopy.value },
    fill: { label: fillCopy.text },
    color: { label: formatCopy.color },
    size: { label: formatCopy.sizeGroup },
    font: { label: textCopy.font },
    bold: { label: formatCopy.named.bold },
    italic: { label: formatCopy.named.italic },
    underline: { label: formatCopy.named.underline },
    align: { label: formatCopy.alignGroup },
    list: { label: textCopy.list },
    case: { label: textCopy.case },
    strike: { label: formatCopy.named.strike },
    letterSpacing: { label: textCopy.letterSpacing },
    lineHeight: { label: textCopy.lineHeight },
    spaceBefore: { label: textCopy.spaceBefore },
    spaceAfter: { label: textCopy.spaceAfter },
  },
}
