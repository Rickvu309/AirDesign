import { blankDeckName } from "@airdesign/catalog"
import { orderKeyBetween, doom } from "@airdesign/document"
import { templateTheme } from "@airdesign/templates"

export const startIds = {
  deck: doom.nodeId("s:1"),
  row: doom.nodeId("s:2"),
  slide: doom.nodeId("s:3"),
  title: doom.nodeId("s:4"),
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
      glow: [{ kind: "layerBlur", radius: 8 }],
    },
  } as doom.Theme
}

export function startEdit(): doom.Edit {
  const first = orderKeyBetween(null, null)
  const create = (node: doom.NodeId, type: string, parent: doom.NodeId | undefined) => [
    { node, prop: "type" as const, value: type },
    ...(parent === undefined ? [] : [{ node, prop: "parent" as const, value: { id: parent, at: first } }]),
  ]
  const { deck, row, slide: first_, title } = startIds
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
      ...create(title, "shape", first_),
      { node: title, prop: "name", value: "Title" },
      { node: title, prop: "role", value: "title" },
      { node: title, prop: "box", value: { x: 160, y: 240, w: 1600, h: 300, rotation: 0, flipH: false, flipV: false } },
      {
        node: title,
        prop: "text",
        value: {
          chars: doom.placeholderTitle,
          spans: [],
          paras: [{}],
          style: "bigNumber",
          resize: "fixed",
          alignV: "bottom",
        },
      },
    ],
  }
}
