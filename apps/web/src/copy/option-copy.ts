import { textWords } from "@/copy/text-copy"
import { bodyWords } from "@/copy/body-copy"
import { boxWords } from "@/copy/box-copy"
import { connectionWords } from "@/copy/connection-copy"
import { fillWords } from "@/copy/fill-copy"
import { borderWords } from "@/copy/border-copy"
import { geometryWords } from "@/copy/geometry-copy"
import { pictureWords } from "@/copy/picture-copy"
import { layoutWords, sizingShown } from "@/copy/frame-copy"
import { guideWords } from "@/copy/guide-copy"

export const optionCopy: Readonly<Record<string, string>> = {
  ...textWords,
  left: "Left",
  center: "Center",
  right: "Right",
  justify: "Justify",
  ...boxWords,
  ...geometryWords,
  ...fillWords,
  ...borderWords,
  ...bodyWords,
  ...pictureWords,
  ...connectionWords,
  ...layoutWords,
  ...guideWords,
  name: "Name",
  id: "Text style",
  size: "Size",
  font: "Font",
}

export function optionWord(field: string, option: string): string {
  return optionCopy[`${field}.${option}`] ?? optionCopy[option] ?? option
}

const shownCopy: Readonly<Record<string, string>> = sizingShown

export function shownWord(field: string, option: string): string {
  return shownCopy[`${field}.${option}`] ?? optionWord(field, option)
}
