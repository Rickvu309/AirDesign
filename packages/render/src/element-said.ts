export type Named = ReadonlyMap<string, string>

function slidePart(key: string): string {
  const at = key.indexOf("#")
  return at < 0 ? key : key.slice(0, at)
}

export function namedFrames(host: HTMLElement): Named {
  const named = new Map<string, string>()
  for (const frame of host.querySelectorAll<HTMLElement>("[data-canvas-element][aria-label]")) {
    const key = frame.dataset["canvasElement"]
    const label = frame.getAttribute("aria-label")
    if (key !== undefined && label !== null && !named.has(key)) named.set(key, label)
  }
  return named
}

export function shownPart(named: Named, last: string | null): string | null {
  const first = named.keys().next()
  return first.done === true ? last : slidePart(first.value)
}

export function changeSaid(before: Named, after: Named, last: string | null): string | null {
  const parts = new Set([...before.keys(), ...after.keys()].map(slidePart))
  if (parts.size !== 1 || (before.size === 0 && !parts.has(last ?? ""))) return null
  const said = [
    ...[...after].filter(([key]) => !before.has(key)).map(([, label]) => `${label} added`),
    ...[...before].filter(([key]) => !after.has(key)).map(([, label]) => `${label} deleted`),
  ]
  return said.length === 0 ? null : said.join(". ")
}
