import { optionWord } from "@/copy/option-copy"

export type ChoiceLayout = "segments" | "grid" | "list"

const segments = 4
const actions = 6
const rowLength = 3
const segmentWord = 12

export function choiceLayout(field: string, options: readonly string[], action: boolean): ChoiceLayout {
  if (options.length > (action ? actions : segments)) return "list"
  if (options.some((option) => optionWord(field, option).length > segmentWord)) return "list"
  return options.length > rowLength + 1 ? "grid" : "segments"
}
