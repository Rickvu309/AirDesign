import { expect, it } from "vitest"
import {
  defaultTheme,
  measureWith,
  resolveSlide,
  doomFromTree,
  viewOf,
  type Resolved,
  type Doom,
  type TreeNode,
} from "./index.js"
import type { Text } from "./text.js"

const spot = (x: number, y: number, w = 300, h = 100) => ({ x, y, w, h, rotation: 0, flipH: false, flipV: false })
const words = (chars: string) =>
  ({ chars, spans: [], paras: [{}], style: "body", resize: "height", alignV: "top" }) as unknown as Text
const label = (name: string, x: number, chars: string): TreeNode => ({
  type: "shape",
  name,
  props: { box: spot(x, 20), text: words(chars) } as never,
})

function board() {
  const grown = doomFromTree({
    theme: defaultTheme,
    slides: [
      {
        children: [
          label("one", 0, "First"),
          label("two", 400, "Second"),
          {
            type: "frame",
            name: "group",
            props: { box: spot(0, 300, 900, 300) } as never,
            children: [label("inner", 10, "Inside")],
          },
        ],
      },
    ],
  })
  return { doom: grown.doom, slide: grown.slides[0]!, ids: grown.ids as Record<string, string> }
}

const retyped = (doom: Doom, id: string, chars: string) =>
  viewOf(doom, [
    {
      once: "typed",
      author: { kind: "person", id: "t" },
      writes: [{ node: id as never, prop: "text", value: words(chars) }],
    },
  ])

const byId = (nodes: readonly Resolved[], id: string) => nodes.find((node) => node.id === id)!

it("gives back the same resolved node for a node an edit to its sibling did not touch", () => {
  const { doom, slide, ids } = board()
  const measure = measureWith({})
  const before = resolveSlide(doom, slide, measure)
  const after = resolveSlide(retyped(doom, ids.one!, "First!"), slide, measure)
  expect(byId(after, ids.one!)).not.toBe(byId(before, ids.one!))
  expect(byId(after, ids.two!)).toBe(byId(before, ids.two!))
  expect(byId(after, ids.group!)).toBe(byId(before, ids.group!))
})

it("gives back the same group when only a node outside it changed, and a new one when a node inside it changed", () => {
  const { doom, slide, ids } = board()
  const measure = measureWith({})
  const before = resolveSlide(doom, slide, measure)
  const inside = resolveSlide(retyped(doom, ids.inner!, "Inside!"), slide, measure)
  expect(byId(inside, ids.group!)).not.toBe(byId(before, ids.group!))
  expect(byId(inside, ids.one!)).toBe(byId(before, ids.one!))
})

it("resolves again when the measure changes, and when the theme changes", () => {
  const { doom, slide, ids } = board()
  const before = resolveSlide(doom, slide, measureWith({}))
  const other = resolveSlide(doom, slide, measureWith({}))
  expect(byId(other, ids.two!)).not.toBe(byId(before, ids.two!))
  const deck = [...doom.nodes.values()].find((node) => node.type === "deck")!
  const themed = viewOf(doom, [
    {
      once: "theme",
      author: { kind: "person", id: "t" },
      writes: [{ node: deck.id, prop: "theme.colors.text", value: defaultTheme.colors.accent2 }],
    },
  ])
  const measure = measureWith({})
  const first = resolveSlide(doom, slide, measure)
  const second = resolveSlide(themed, slide, measure)
  expect(byId(second, ids.two!)).not.toBe(byId(first, ids.two!))
})

it("measures the same text at the same width once", () => {
  const measure = measureWith({})
  const { doom } = board()
  const text = [...doom.nodes.values()].flatMap((node) =>
    "text" in node && node.text !== undefined ? [node.text] : [],
  )[0]!
  expect(measure(text, defaultTheme, 300)).toBe(measure(text, defaultTheme, 300))
  expect(measure(text, defaultTheme, 300)).not.toBe(measure(text, defaultTheme, 310))
})
