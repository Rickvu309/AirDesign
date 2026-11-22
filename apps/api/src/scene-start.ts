import { blankDeckName } from "@airdesign/catalog"
import { orderKeyBetween, scene } from "@airdesign/document"
import { templateTheme } from "@airdesign/templates"

export const startIds = {
  deck: scene.nodeId("s:1"),
  row: scene.nodeId("s:2"),
  slide: scene.nodeId("s:3"),
  title: scene.nodeId("s:4"),
} as const

export const startAuthor: scene.Author = { kind: "person", id: "airdesign" }

const slide = { w: 1920, h: 1080 } as const

const neutralStyles = {
  bigNumber: { size: 108, font: "heading", weight: 400, lineHeight: 1, tracking: 0 },
  title: { size: 56, font: "heading", weight: 400, lineHeight: 1.05, tracking: 0 },
  heading: { size: 40, font: "heading", weight: 400, lineHeight: 1.1, tracking: 0 },
  body: { size: 32, font: "body", weight: 400, lineHeight: 1.25, tracking: 0 },
  body2: { size: 28, font: "body", weight: 400, lineHeight: 1.25, tracking: 0 },
  caption: { size: 24, font: "body", weight: 400, lineHeight: 1.2, tracking: 0 },
  label: { size: 24, font: "heading", weight: 400, lineHeight: 1.2, tracking: 2 },
} as const

const shadow = (y: number, blur: number) => ({ kind: "dropShadow", color: { var: "text" }, x: 0, y, blur, spread: 0 })

function neutralTheme(): scene.Theme {
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
    textStyles: neutralStyles,
    effectStyles: {
      soft: [shadow(4, 12)],
      lifted: [shadow(12, 32)],
      glow: [{ kind: "layerBlur", radius: 8 }],
    },
  } as scene.Theme
}

export function startEdit(): scene.Edit {
  const first = orderKeyBetween(null, null)
  const create = (node: scene.NodeId, type: string, parent: scene.NodeId | undefined) => [
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
          chars: "Untitled",
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
