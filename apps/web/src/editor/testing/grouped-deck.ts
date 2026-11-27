import * as doom from "@airdesign/doom"
import { landed } from "./doom-fixtures"
import { testTheme } from "@airdesign/doom/testing"

export function minter(tab = "m") {
  let next = 0
  return () => doom.nodeId(`${tab}:${String((next += 1))}`)
}

export function grouped(sizes: readonly number[], ties: readonly boolean[] = []) {
  const total = sizes.reduce((sum, size) => sum + size, 0)
  const grown = doom.doomFromTree({
    theme: testTheme,
    slides: Array.from({ length: total }, (_, at) => ({ name: `S${String(at + 1)}`, children: [] })),
  })
  const first = doom.parentOf(grown.doom.nodes.get(grown.slides[0]!))!
  const deck = doom.parentOf(grown.doom.nodes.get(first.id))!
  const tie = (at: number) => ties[at % Math.max(1, ties.length)] === true
  const writes: doom.Write[] = []
  let groupAt = first.at
  let start = 0
  sizes.forEach((size, number) => {
    const group = number === 0 ? first.id : doom.nodeId(`g:${String(number + 1)}`)
    if (number > 0) {
      groupAt = tie(number) ? groupAt : doom.orderKeyBetween(groupAt, null)
      writes.push(
        { node: group, prop: "type", value: "slideRow" },
        { node: group, prop: "parent", value: { id: deck.id, at: groupAt } },
      )
    }
    let at: doom.OrderKey | null = null
    grown.slides.slice(start, start + size).forEach((slide, offset) => {
      at = at !== null && tie(start + offset) ? at : doom.orderKeyBetween(at, null)
      writes.push({ node: slide, prop: "parent", value: { id: group, at } })
    })
    start += size
  })
  return { view: landed(grown.doom, writes), slides: grown.slides }
}

export function undone(view: doom.Doom, writes: readonly doom.Write[]): doom.Doom {
  const after = landed(view, writes)
  const asked = { once: "asked", author: { kind: "person" as const, id: "test" }, writes, rev: doom.rev(view.rev + 1) }
  return landed(after, doom.invert(view, after, asked))
}
