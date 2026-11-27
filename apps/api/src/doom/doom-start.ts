import { blankDeckName } from "@airdesign/catalog"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { newDeckTheme } from "@airdesign/taste"

export const startIds = {
  deck: doom.nodeId("s:1"),
  row: doom.nodeId("s:2"),
  slide: doom.nodeId("s:3"),
  title: doom.nodeId("s:4"),
  subtitle: doom.nodeId("s:5"),
} as const

export const startAuthor: doom.Author = { kind: "person", id: "airdesign" }

const slide = { w: 1920, h: 1080 } as const

export type DeckStart = { readonly name: string; readonly theme?: doom.Theme }

export function startEdit({ name, theme = newDeckTheme }: DeckStart = { name: blankDeckName }): doom.Edit {
  const first = orderKeyBetween(null, null)
  const create = (node: doom.NodeId, type: string, parent: doom.NodeId | undefined) => [
    { node, prop: "type" as const, value: type },
    ...(parent === undefined ? [] : [{ node, prop: "parent" as const, value: { id: parent, at: first } }]),
  ]
  const { deck, row, slide: first_, title, subtitle } = startIds
  const ids = [title, subtitle]
  const minter = () => ids.shift() as doom.NodeId
  return {
    once: "start",
    author: startAuthor,
    writes: [
      ...create(deck, "deck", undefined),
      { node: deck, prop: "name", value: name },
      { node: deck, prop: "nameFollows", value: name === blankDeckName },
      { node: deck, prop: "theme", value: theme },
      { node: deck, prop: "size", value: slide },
      ...create(row, "slideRow", deck),
      ...create(first_, "slide", row),
      { node: first_, prop: "name", value: "Title" },
      ...doom.titleSlideWrites(first_, minter, slide),
    ],
  }
}
