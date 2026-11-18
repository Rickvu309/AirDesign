import { textWords } from "@/copy/text-copy"
import { bodyWords } from "@/copy/body-copy"
import { boxWords } from "@/copy/box-copy"
import { connectionWords } from "@/copy/connection-copy"
import { effectsWords } from "@/copy/effects-copy"
import { fillWords } from "@/copy/fill-copy"
import { borderWords } from "@/copy/border-copy"
import { geometryWords } from "@/copy/geometry-copy"
import { pictureWords } from "@/copy/picture-copy"
import { transitionWords } from "@/copy/transition-copy"

export const optionCopy: Readonly<Record<string, string>> = {
  ...textWords,
  left: "Left",
  center: "Center",
  right: "Right",
  ...boxWords,
  ...geometryWords,
  ...fillWords,
  ...borderWords,
  ...effectsWords,
  ...bodyWords,
  ...pictureWords,
  ...connectionWords,
  ...transitionWords,
  name: "Name",
  id: "Text style",
  size: "Size",
  font: "Font",
}

export function optionWord(field: string, option: string): string {
  return optionCopy[`${field}.${option}`] ?? optionCopy[option] ?? option
}
