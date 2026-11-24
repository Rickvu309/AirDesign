const listed = (names: readonly string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(names)

export const agentRunsCopy = {
  title: "Agents on this deck",
  someone: "An agent",
  undone: "Undone",
  undoRefused: "Couldn't undo. Something it changed was changed again after its edit.",
  nothingLeft: "Nothing left to undo. Everything it changed was changed or deleted since.",
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

function opening(layers: readonly string[]): string {
  const named = listed(layers)
  return `${named.charAt(0).toUpperCase()}${named.slice(1)}`
}

export function agentLeftLayers(layers: readonly string[]): string {
  return layers.length === 1
    ? `${opening(layers)} stays where it is, because the frame it came from was deleted or moved since.`
    : `${opening(layers)} stay where they are, because the frames they came from were deleted or moved since.`
}

export function agentWaitingLayers(layers: readonly string[]): string {
  return layers.length === 1
    ? `${opening(layers)} can't come back until the frame it was in is back.`
    : `${opening(layers)} can't come back until the frames they were in are back.`
}

export type UndoStays = {
  readonly kept: readonly string[]
  readonly left: readonly string[]
  readonly waiting: readonly string[]
}

export function agentUndoStays(agent: string, stays: UndoStays): string {
  return [
    ...(stays.kept.length === 0 ? [] : [agentKeptLayers(agent, stays.kept)]),
    ...(stays.left.length === 0 ? [] : [agentLeftLayers(stays.left)]),
    ...(stays.waiting.length === 0 ? [] : [agentWaitingLayers(stays.waiting)]),
  ].join(" ")
}

export function agentKeptLayers(agent: string, layers: readonly string[]): string {
  return layers.length === 1
    ? `${opening(layers)} stays, because it was changed after ${agent} made it.`
    : `${opening(layers)} stay, because they were changed after ${agent} made them.`
}
