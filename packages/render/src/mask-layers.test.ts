import * as doom from "@airdesign/doom"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SlidePaint } from "./doom-slide.js"
import { NodeArt } from "./node-art.js"
import { roundedRectPath } from "./node-outline.js"
import { swatches } from "./testing/swatches-art.js"

const spot = (x: number, y: number, w: number, h: number, extra: object = {}) => ({
  x,
  y,
  w,
  h,
  rotation: 0,
  flipH: false,
  flipV: false,
  ...extra,
})
const fill = (color: string) => [{ kind: "solid" as const, color }]
const shape = (name: string, props: object): doom.TreeNode => ({ type: "shape", name, props: props as never })

function painted(children: readonly doom.TreeNode[]) {
  const grown = doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        children: [
          {
            type: "frame",
            name: "group",
            props: { box: spot(0, 0, 400, 300) },
            children,
          },
        ],
      },
    ],
  })
  const resolved = doom.resolveSlide(grown.doom, grown.slides[0]!, doom.measureWith({}))
  const html = renderToStaticMarkup(
    createElement(
      "div",
      null,
      resolved.map((node) => createElement(NodeArt, { key: node.id, node, assetUrl: () => undefined })),
    ),
  ).replaceAll("&quot;", '"')
  return { html, ids: grown.ids }
}

function slide(children: readonly doom.TreeNode[]) {
  const grown = doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children, props: { source: "Source: X" } }] })
  const measure = doom.measureWith({})
  const resolved = doom.resolveSlide(grown.doom, grown.slides[0]!, measure)
  const html = renderToStaticMarkup(
    createElement(SlidePaint, {
      nodes: resolved,
      footer: doom.resolveFooter(grown.doom, grown.slides[0]!, measure),
      background: [],
      size: { w: 1920, h: 1080 },
      width: 1920,
    }),
  ).replaceAll("&quot;", '"')
  return { html, ids: grown.ids }
}

describe("a mask clips the layers above it to its outline and does not paint", () => {
  it("clips only the layers after the mask, to its rounded outline", () => {
    const { html, ids } = painted([
      shape("back", { box: spot(10, 10, 80, 60), fills: fill(swatches.black) }),
      shape("hole", { box: spot(40, 30, 200, 120), radius: 24, fills: fill(swatches.red), mask: true }),
      shape("front", { box: spot(20, 20, 300, 200), fills: fill(swatches.white) }),
    ])
    expect(html).not.toContain(`data-node="${ids.hole}"`)
    expect(html).not.toContain(swatches.red)
    expect(html).toContain(`d="${roundedRectPath(200, 120, [24, 24, 24, 24])}"`)
    expect(html).toContain('transform="matrix(1 0 0 1 40 30)"')
    const back = html.indexOf(`data-node="${ids.back}"`)
    const clip = html.indexOf("mask:url(#")
    const front = html.indexOf(`data-node="${ids.front}"`)
    expect(back).toBeGreaterThanOrEqual(0)
    expect(back).toBeLessThan(clip)
    expect(clip).toBeLessThan(front)
  })

  it("ends one mask at the next, and fades the reveal by the mask's opacity", () => {
    const { html, ids } = painted([
      shape("hole", {
        box: spot(0, 0, 100, 80),
        fills: fill(swatches.red),
        opacity: 0.5,
        mask: true,
      }),
      shape("front", { box: spot(0, 0, 100, 80), fills: fill(swatches.white) }),
      shape("hole2", {
        box: spot(120, 0, 80, 80),
        geometry: { kind: "ellipse" },
        fills: fill(swatches.black),
        mask: true,
      }),
      shape("side", { box: spot(120, 0, 80, 80), fills: fill(swatches.white) }),
    ])
    expect(html).not.toContain(`data-node="${ids.hole}"`)
    expect(html).not.toContain(`data-node="${ids.hole2}"`)
    expect(html).toContain('fill-opacity="0.5"')
    expect(html).toContain('d="M0 40A40 40 0 1 0 80 40A40 40 0 1 0 0 40Z"')
    const first = html.indexOf(`data-node="${ids.front}"`)
    const second = html.indexOf(`data-node="${ids.side}"`)
    const clips = [...html.matchAll(/mask:url\(#/g)].map((match) => match.index ?? -1)
    expect(clips).toHaveLength(2)
    expect(clips[0]!).toBeLessThan(first)
    expect(first).toBeLessThan(clips[1]!)
    expect(clips[1]!).toBeLessThan(second)
  })

  it("clips the slide's own layers the same way", () => {
    const { html, ids } = slide([
      shape("back", { box: spot(0, 0, 40, 40), fills: fill(swatches.black), mask: true }),
      shape("front", { box: spot(0, 0, 80, 40), fills: fill(swatches.white) }),
    ])
    expect(html).not.toContain(`data-node="${ids.back}"`)
    expect(html.indexOf("mask:url(#")).toBeLessThan(html.indexOf(`data-node="${ids.front}"`))
  })

  it("leaves the slide's footer outside a mask on its content", () => {
    const { html } = slide([
      shape("cover", { box: spot(0, 0, 1920, 1080), fills: fill(swatches.black), mask: true }),
      shape("front", { box: spot(0, 0, 1920, 1080), fills: fill(swatches.white) }),
    ])
    const wrapper = html.lastIndexOf("<div", html.indexOf("mask:url(#"))
    const footer = html.indexOf("data-slide-footer")
    const between = html.slice(wrapper, html.lastIndexOf("<div", footer))
    expect(footer).toBeGreaterThan(wrapper)
    expect(between.split("</div>").length).toBe(between.split("<div").length)
    expect(html.slice(footer)).toContain('data-footer="source"')
    expect(html.slice(footer)).toContain('data-footer="number"')
  })

  it("turns the outline with the mask", () => {
    const { html } = painted([
      shape("hole", {
        box: spot(10, 20, 100, 80, { rotation: 15 }),
        fills: fill(swatches.red),
        mask: true,
      }),
      shape("front", { box: spot(10, 20, 100, 80), fills: fill(swatches.white) }),
    ])
    expect(html).toContain('transform="matrix(0.966 0.259 -0.259 0.966 22.056 8.422)"')
  })

  it("mirrors the outline with a flipped mask", () => {
    const { html } = painted([
      shape("hole", {
        box: spot(10, 20, 100, 80, { flipH: true }),
        radius: [40, 0, 0, 0],
        fills: fill(swatches.red),
        mask: true,
      }),
      shape("front", { box: spot(10, 20, 100, 80), fills: fill(swatches.white) }),
    ])
    expect(html).toContain('transform="matrix(-1 0 0 1 110 20)"')
  })
})
