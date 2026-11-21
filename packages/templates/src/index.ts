export const deckTemplates: readonly { readonly id: string; readonly name: string }[] = [
  { id: "neutral", name: "Neutral" },
  { id: "midnight", name: "Midnight" },
  { id: "editorial", name: "Editorial" },
]

export const blankTemplate = "neutral"

export function templateFile(id: string, start = false): string {
  return `files/${id}${start ? "-start" : ""}.pptx`
}

export function startIndexFile(id: string): string {
  return `files/${id}-start.index.json`
}
