import { blankDeckName } from "@airdesign/catalog"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { templateTheme } from "@airdesign/templates"

export const startIds = {
  deck: doom.nodeId("s:1"),
  row: doom.nodeId("s:2"),
  slide: doom.nodeId("s:3"),
  title: doom.nodeId("s:4"),
  subtitle: doom.nodeId("s:5"),
} as const

export const startAuthor: doom.Author = { kind: "person", id: "airdesign" }

const slide = { w: 1920, h: 1080 } as const

const shadow = (y: number, blur: number) => ({ kind: "dropShadow", color: { var: "text" }, x: 0, y, blur, spread: 0 })

function neutralTheme(): doom.Theme {
  const neutral = templateTheme("neutral")
  if (neutral === undefined) throw new Error("neutral template")
  const { colors, fonts } = neutral
  const hex = (value: string) => `#${value.toLowerCase()}`
  return {
    colors: {
      text: hex(colors.dk1),
      background: hex(colors.lt1),
      text2: hex(colors.dk2),
      background2: hex(colors.lt2),
      accent1: hex(colors.accent1),
      accent2: hex(colors.accent2),
      accent3: hex(colors.accent3),
      accent4: hex(colors.accent4),
      accent5: hex(colors.accent5),
      accent6: hex(colors.accent6),
      link: hex(colors.hlink),
    },
    fonts: { heading: fonts.major, body: fonts.minor },
    textStyles: doom.slideTextStyles,
    effectStyles: {
      soft: [shadow(4, 12)],
      lifted: [shadow(12, 32)],
      glow: doom.defaultTheme.effectStyles.glow,
    },
  } as doom.Theme
}

export function startEdit(): doom.Edit {
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
      { node: deck, prop: "name", value: blankDeckName },
      { node: deck, prop: "theme", value: neutralTheme() },
      { node: deck, prop: "size", value: slide },
      ...create(row, "slideRow", deck),
      ...create(first_, "slide", row),
      { node: first_, prop: "name", value: "Title" },
      ...doom.titleSlideWrites(first_, minter, slide),
    ],
  }
}
