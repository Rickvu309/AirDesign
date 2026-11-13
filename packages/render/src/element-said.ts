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

function elementSaid(before: Named, after: Named): string | null {
  const said = [
    ...[...after].filter(([key]) => !before.has(key)).map(([, label]) => `${label} added`),
    ...[...before].filter(([key]) => !after.has(key)).map(([, label]) => `${label} deleted`),
  ]
  return said.length === 0 ? null : said.join(". ")
}

function onPart(named: Named, part: string): Named {
  const kept = new Map<string, string>()
  for (const [key, label] of named) if (slidePart(key) === part) kept.set(key, label)
  return kept
}

export function changeSaid(
  before: Named,
  after: Named,
  last: string | null,
  shown: string | null = null,
  name: string | null = null,
): string | null {
  if (shown !== null && last !== null && shown !== last) return name
  if (shown !== null && last !== null) return elementSaid(onPart(before, shown), onPart(after, shown))
  const parts = new Set([...before.keys(), ...after.keys()].map(slidePart))
  if (parts.size !== 1 || (before.size === 0 && !parts.has(last ?? ""))) return null
  return elementSaid(before, after)
}
