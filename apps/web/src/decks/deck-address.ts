export type DeckAddress = { readonly list: boolean; readonly query: string }

export function addressRead(search: string): DeckAddress {
  const params = new URLSearchParams(search)
  return { list: params.get("view") === "list", query: params.get("q") ?? "" }
}

export function addressOf(path: string, address: DeckAddress): string {
  const params = new URLSearchParams()
  if (address.list) params.set("view", "list")
  if (address.query !== "") params.set("q", address.query)
  const text = params.toString()
  return text === "" ? path : `${path}?${text}`
}
