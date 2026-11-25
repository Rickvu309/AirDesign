const listed = (names: readonly string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(names)

export const agentRunsCopy = {
  someone: "An agent",
  undoTooLarge: "Unable to undo. This run made too many changes.",
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
