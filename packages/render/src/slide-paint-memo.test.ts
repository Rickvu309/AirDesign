import { doom } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import { loadIcon } from "./icon-nodes.js"
import { SlidePaint } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const spot = (x: number) => ({ x, y: 20, w: 300, h: 100, rotation: 0, flipH: false, flipV: false })
const words = (chars: string) =>
  ({ chars, spans: [], paras: [{}], style: "body", resize: "height", alignV: "top" }) as never
const picture = (name: string, x: number): doom.TreeNode => ({
  type: "shape",
  name,
  props: { box: spot(x), text: words(name), fills: [{ kind: "image", asset: name, fit: "fill" }] } as never,
})

const board = () =>
  doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [{ children: [picture("one", 0), picture("two", 400), picture("three", 800)] }],
  })

const looked: string[] = []
const lookup = (asset: string) => {
  looked.push(asset)
  return undefined
}

async function paint(nodes: readonly doom.Resolved[], host?: object, iconsReady = true) {
  const mounted = hosts[0] ?? {
    host: document.body.appendChild(document.createElement("div")),
    root: undefined as never,
  }
  if (hosts.length === 0) {
    mounted.root = createRoot(mounted.host)
    hosts.push(mounted)
  }
  await act(async () => {
    mounted.root.render(
      createElement(SlidePaint, {
        nodes,
        background: [],
        size: { w: 1920, h: 1080 },
        width: 960,
        waiting: "Uploading",
        assetUrl: lookup,
        iconsReady,
        ...(host === undefined ? {} : { host }),
      } as never),
    )
  })
  return mounted.host
}

it("redraws only the node whose resolved art changed", async () => {
  const grown = board()
  const slide = grown.slides[0]!
  const measure = doom.measureWith({})
  const ids = grown.ids as Record<string, string>
  const first = doom.resolveSlide(grown.doom, slide, measure)
  await paint(first)
  expect(new Set(looked)).toEqual(new Set(["one", "two", "three"]))
  looked.length = 0
  const typed = doom.viewOf(grown.doom, [
    {
      once: "typed",
      author: { kind: "person", id: "t" },
      writes: [{ node: ids.two as never, prop: "text", value: words("Second!") }],
    },
  ])
  await paint(doom.resolveSlide(typed, slide, measure))
  expect(new Set(looked)).toEqual(new Set(["two"]))
})

it("shows the text editor inside the node it is given for, and redraws that node with each new editor", async () => {
  const grown = board()
  const slide = grown.slides[0]!
  const ids = grown.ids as Record<string, string>
  const nodes = doom.resolveSlide(grown.doom, slide, doom.measureWith({}))
  const editor = (label: string) => ({ id: ids.two, render: () => createElement("i", { "data-editor": label }) })
  const host = await paint(nodes, editor("a"))
  expect(host.querySelectorAll("[data-editor]")).toHaveLength(1)
  expect(host.querySelector(`[data-node="${ids.two}"] [data-editor="a"]`)).not.toBeNull()
  looked.length = 0
  await paint(nodes, editor("b"))
  expect(host.querySelector(`[data-node="${ids.two}"] [data-editor="b"]`)).not.toBeNull()
  expect(new Set(looked)).toEqual(new Set(["two"]))
  await paint(nodes)
  expect(host.querySelectorAll("[data-editor]")).toHaveLength(0)
})

it("draws an icon once its art has loaded, though the node itself did not change", async () => {
  const grown = doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        children: [
          {
            type: "shape",
            name: "star",
            props: {
              box: spot(0),
              geometry: { kind: "icon", name: "lucide/star" },
              strokes: [{ kind: "solid", color: { var: "text" } }],
            } as never,
          },
        ],
      },
    ],
  })
  const nodes = doom.resolveSlide(grown.doom, grown.slides[0]!, doom.measureWith({}))
  const host = await paint(nodes, undefined, false)
  expect(host.querySelector("svg")).toBeNull()
  await loadIcon("lucide/star")
  await paint(nodes, undefined, true)
  expect(host.querySelector("svg")).not.toBeNull()
})
