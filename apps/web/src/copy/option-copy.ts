import { boxWords } from "@/copy/box-copy"
import { fillWords } from "@/copy/fill-copy"
import { lineWords } from "@/copy/line-copy"
import { geometryWords } from "@/copy/geometry-copy"

export const optionCopy: Readonly<Record<string, string>> = {
  left: "Left",
  center: "Center",
  right: "Right",
  ...boxWords,
  ...geometryWords,
  ...fillWords,
  ...lineWords,
}

export function optionWord(field: string, option: string): string {
  return optionCopy[`${field}.${option}`] ?? optionCopy[option] ?? option
}
