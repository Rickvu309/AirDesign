const listed = (names: readonly string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(names)

export const agentRunsCopy = {
  title: "Agents on this deck",
  someone: "An agent",
  undone: "Undone",
  undoRefused: "Unable to undo. Something it changed was changed again after its edit.",
  nothingLeft: "Unable to undo. Everything it changed was changed or deleted since.",
  undoTooLarge: "Unable to undo. This run made too many changes.",
  undoFailed: "Unable to undo. Check your connection and try again.",
} as const

export function agentShownName(name: string): string {
  return name === "" ? agentRunsCopy.someone : name
}

export type EditingAt = { readonly here: boolean; readonly slide?: number | undefined }

export function agentEditingMark(names: readonly string[], at: EditingAt): string {
  if (names.length > 1) return `${listed(names)} are editing`
  const [name = agentRunsCopy.someone] = names
  if (at.here) return `${name} is editing this slide`
  return at.slide === undefined ? `${name} is editing` : `${name} is editing slide ${String(at.slide)}`
}

export type RunPlace = { readonly slide: number } | "gone" | "deck"

export function agentRunStatus(live: boolean, place: RunPlace): string {
  if (place === "deck") return live ? "Editing the deck" : "Last edited the deck"
  if (place === "gone") return live ? "Editing a deleted slide" : "Last edited a slide since deleted"
  return live ? `Editing slide ${String(place.slide)}` : `Last edited slide ${String(place.slide)}`
}
