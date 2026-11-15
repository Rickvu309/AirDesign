import { optionWord } from "@/copy/option-copy"

export type ChoiceLayout = "segments" | "list"

const segments = 4
const segmentWord = 12

export function choiceLayout(field: string, options: readonly string[]): ChoiceLayout {
  if (options.length > segments) return "list"
  if (options.some((option) => optionWord(field, option).length > segmentWord)) return "list"
  return "segments"
}
