import { bodyWords } from "@/copy/body-copy"
import { boxWords } from "@/copy/box-copy"
import { effectsWords } from "@/copy/effects-copy"
import { fillWords } from "@/copy/fill-copy"
import { lineWords } from "@/copy/line-copy"
import { geometryWords } from "@/copy/geometry-copy"
import { pictureWords } from "@/copy/picture-copy"
import { tableWords } from "@/copy/table-copy"

export const optionCopy: Readonly<Record<string, string>> = {
  left: "Left",
  center: "Center",
  right: "Right",
  ...boxWords,
  ...geometryWords,
  ...fillWords,
  ...lineWords,
  ...effectsWords,
  ...bodyWords,
  ...pictureWords,
  ...tableWords,
}

export function optionWord(field: string, option: string): string {
  return optionCopy[`${field}.${option}`] ?? optionCopy[option] ?? option
}
