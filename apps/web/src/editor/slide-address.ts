const key = "node-id"

export function slideAddressRead(search: string): string | null {
  const id = new URLSearchParams(search).get(key)
  return id === null || id === "" ? null : id
}

export function deckAddressOf(at: { readonly search: string; readonly hash: string }, deck: string): string {
  return `/s/${deck}${at.search}${at.hash}`
}

export function replaceDeckAddress(
  history: { readonly state: unknown; replaceState(state: unknown, title: string, url: string): void },
  location: { readonly search: string; readonly hash: string },
  deck: string,
): void {
  history.replaceState(history.state, "", deckAddressOf(location, deck))
}

export function slideAddressOf(
  at: { readonly pathname: string; readonly search: string; readonly hash: string },
  slide: string,
): string {
  const params = new URLSearchParams(at.search)
  params.set(key, slide)
  return `${at.pathname}?${params.toString()}${at.hash}`
}
