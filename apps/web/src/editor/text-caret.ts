export type Place = { readonly node: Node; readonly at: number }

const textLength = (node: Node) => node.textContent?.length ?? 0
const isElement = (node: Node): node is HTMLElement => node.nodeType === 1

function lineOf(host: Element, node: Node): HTMLElement | null {
  const element = isElement(node) ? node : node.parentElement
  const line = element?.closest<HTMLElement>("[data-line]") ?? null
  return line !== null && host.contains(line) ? line : null
}

const startOf = (line: HTMLElement) => Number(line.dataset.start)
const endOf = (line: HTMLElement) => Number(line.dataset.end)

function runsOf(line: HTMLElement): readonly HTMLElement[] {
  return [...line.querySelectorAll<HTMLElement>("[data-run]")]
}

export function offsetOfPlace(host: HTMLElement, place: Place): number | null {
  const lines = [...host.querySelectorAll<HTMLElement>("[data-line]")]
  if (place.node === host) {
    const next = lines[place.at]
    const last = lines[lines.length - 1]
    if (next !== undefined) return startOf(next)
    return last === undefined ? 0 : endOf(last)
  }
  const line = lineOf(host, place.node)
  if (line === null) return null
  const start = startOf(line)
  if (place.node === line) {
    const before = [...line.childNodes].slice(0, place.at)
    return (
      start +
      before.reduce((sum, child) => sum + (isElement(child) && "run" in child.dataset ? textLength(child) : 0), 0)
    )
  }
  const element = isElement(place.node) ? place.node : place.node.parentElement
  const run = element?.closest<HTMLElement>("[data-run]") ?? null
  if (run === null) return start
  let before = 0
  for (const each of runsOf(line)) {
    if (each === run) break
    before += textLength(each)
  }
  const inside = isElement(place.node)
    ? [...run.childNodes].slice(0, place.at).reduce((sum, child) => sum + textLength(child), 0)
    : place.at
  return Math.min(endOf(line), start + before + inside)
}

export function placeOfOffset(host: HTMLElement, offset: number): Place | null {
  const lines = [...host.querySelectorAll<HTMLElement>("[data-line]")]
  const target = lines.filter((line) => startOf(line) <= offset).at(-1) ?? lines[0]
  if (target === undefined) return null
  let local = offset - startOf(target)
  const runs = runsOf(target)
  if (runs.length === 0) return { node: target, at: 0 }
  for (const run of runs) {
    const node = run.firstChild
    const length = textLength(run)
    if (node !== null && local <= length) return { node, at: Math.max(0, local) }
    local -= length
  }
  const last = runs[runs.length - 1]!.firstChild
  return last === null ? { node: target, at: 0 } : { node: last, at: textLength(last) }
}
