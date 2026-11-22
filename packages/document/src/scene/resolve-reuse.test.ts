import { expect, it } from "vitest"
import {
  defaultTheme,
  measureWith,
  resolveSlide,
  sceneFromTree,
  viewOf,
  type Resolved,
  type Scene,
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
  const grown = sceneFromTree({
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
  return { scene: grown.scene, slide: grown.slides[0]!, ids: grown.ids as Record<string, string> }
}

const retyped = (scene: Scene, id: string, chars: string) =>
  viewOf(scene, [
    {
      once: "typed",
      author: { kind: "person", id: "t" },
      writes: [{ node: id as never, prop: "text", value: words(chars) }],
    },
  ])

const byId = (nodes: readonly Resolved[], id: string) => nodes.find((node) => node.id === id)!

it("gives back the same resolved node for a node an edit to its sibling did not touch", () => {
  const { scene, slide, ids } = board()
  const measure = measureWith({})
  const before = resolveSlide(scene, slide, measure)
  const after = resolveSlide(retyped(scene, ids.one!, "First!"), slide, measure)
  expect(byId(after, ids.one!)).not.toBe(byId(before, ids.one!))
  expect(byId(after, ids.two!)).toBe(byId(before, ids.two!))
  expect(byId(after, ids.group!)).toBe(byId(before, ids.group!))
})

it("gives back the same group when only a node outside it changed, and a new one when a node inside it changed", () => {
  const { scene, slide, ids } = board()
  const measure = measureWith({})
  const before = resolveSlide(scene, slide, measure)
  const inside = resolveSlide(retyped(scene, ids.inner!, "Inside!"), slide, measure)
  expect(byId(inside, ids.group!)).not.toBe(byId(before, ids.group!))
  expect(byId(inside, ids.one!)).toBe(byId(before, ids.one!))
})

it("resolves again when the measure changes, and when the theme changes", () => {
  const { scene, slide, ids } = board()
  const before = resolveSlide(scene, slide, measureWith({}))
  const other = resolveSlide(scene, slide, measureWith({}))
  expect(byId(other, ids.two!)).not.toBe(byId(before, ids.two!))
  const deck = [...scene.nodes.values()].find((node) => node.type === "deck")!
  const themed = viewOf(scene, [
    {
      once: "theme",
      author: { kind: "person", id: "t" },
      writes: [{ node: deck.id, prop: "theme.colors.text", value: defaultTheme.colors.accent2 }],
    },
  ])
  const measure = measureWith({})
  const first = resolveSlide(scene, slide, measure)
  const second = resolveSlide(themed, slide, measure)
  expect(byId(second, ids.two!)).not.toBe(byId(first, ids.two!))
})

it("measures the same text at the same width once", () => {
  const measure = measureWith({})
  const { scene } = board()
  const text = [...scene.nodes.values()].flatMap((node) =>
    "text" in node && node.text !== undefined ? [node.text] : [],
  )[0]!
  expect(measure(text, defaultTheme, 300)).toBe(measure(text, defaultTheme, 300))
  expect(measure(text, defaultTheme, 300)).not.toBe(measure(text, defaultTheme, 310))
})
