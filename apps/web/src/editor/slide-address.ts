const key = "node-id"

export function slideAddressRead(search: string): string | null {
  const id = new URLSearchParams(search).get(key)
  return id === null || id === "" ? null : id
}

export function slideAddressOf(
  at: { readonly pathname: string; readonly search: string; readonly hash: string },
  slide: string,
): string {
  const params = new URLSearchParams(at.search)
  params.set(key, slide)
  return `${at.pathname}?${params.toString()}${at.hash}`
}
