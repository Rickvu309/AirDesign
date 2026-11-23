const listed = (names: readonly string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(names)

export const agentRunsCopy = {
  title: "Agents on this deck",
  someone: "An agent",
  undone: "Undone",
  undoRefused: "Couldn't undo. Something it changed was changed again after its edit.",
  nothingLeft: "Nothing left to undo. Everything it changed has been changed again since.",
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

export function agentKeptLayers(agent: string, layers: readonly string[]): string {
  const named = listed(layers)
  const opening = `${named.charAt(0).toUpperCase()}${named.slice(1)}`
  return layers.length === 1
    ? `${opening} stays, because it was changed after ${agent} made it.`
    : `${opening} stay, because they were changed after ${agent} made them.`
}
