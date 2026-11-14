import { fillWords } from "@/copy/fill-copy"

export const optionCopy: Readonly<Record<string, string>> = {
  left: "Left",
  center: "Center",
  right: "Right",
  ...fillWords,
}
