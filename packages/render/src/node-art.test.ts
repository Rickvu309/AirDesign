import * as doom from "@airdesign/doom"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadIcon } from "./icon-nodes.js"
import { NodeArt } from "./index.js"
import { swatches } from "./swatches-art.js"

const navy = doom.defaultTheme.colors.accent1

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
const solid = (color: unknown, extra: object = {}) => ({ kind: "solid", color, ...extra })
const shape = (name: string, props: object): doom.TreeNode => ({ type: "shape", name, props: props as never })

function painted(
  nodes: readonly doom.TreeNode[],
  assetUrl: (asset: string) => string | undefined = () => undefined,
  waiting?: string,
) {
  const grown = doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: nodes }] })
  const resolved = doom.resolveSlide(grown.doom, grown.slides[0]!, doom.measureWith({}))
  return renderToStaticMarkup(
    createElement(
      "div",
      null,
      resolved.map((node) =>
        createElement(NodeArt, { key: node.id, node, assetUrl, ...(waiting === undefined ? {} : { waiting }) }),
      ),
    ),
  ).replaceAll("&quot;", '"')
}

describe("NodeArt", () => {
  it("places a node by its box and rounds the box by its radius, filling it with each paint in order", () => {
    const html = painted([
      shape("card", {
        box: spot(40, 30, 300, 200),
        radius: [8, 8, 0, 0],
        fills: [solid({ var: "accent1" }), solid(swatches.white, { opacity: 0.5 })],
      }),
    ])
    expect(html).toContain("left:40px;top:30px;width:300px;height:200px")
    expect(html).toContain("border-radius:8px 8px 0px 0px")
    expect(html.indexOf(`background:${navy}`)).toBeLessThan(html.indexOf(`background:${swatches.white}`))
    expect(html).toContain("opacity:0.5")
  })

  it("draws a gradient from its angle and stops, and a radial gradient from the middle", () => {
    const linear = painted([
      shape("g", {
        box: spot(0, 0, 100, 100),
        fills: [
          {
            kind: "gradient",
            shape: "linear",
            angle: 0,
            stops: [
              { at: 0, color: swatches.black },
              { at: 1, color: swatches.white },
            ],
          },
        ],
      }),
    ])
    expect(linear).toContain(`linear-gradient(90deg, ${swatches.black} 0%, ${swatches.white} 100%)`)
    const radial = painted([
      shape("g", {
        box: spot(0, 0, 100, 100),
        fills: [
          {
            kind: "gradient",
            shape: "radial",
            angle: 0,
            stops: [
              { at: 0, color: swatches.black },
              { at: 1, color: swatches.white },
            ],
          },
        ],
      }),
    ])
    expect(radial).toContain(`radial-gradient(closest-side, ${swatches.black} 0%, ${swatches.white} 100%)`)
  })

  it("draws a picture in its fit, and a crop as the part of the picture it names", () => {
    const urls = (asset: string) => (asset === "known" ? "https://pictures/known.png" : undefined)
    const image = (fit: string, extra: object = {}) =>
      painted(
        [shape("p", { box: spot(0, 0, 200, 100), fills: [{ kind: "image", asset: "known", fit, ...extra }] })],
        urls,
      )
    expect(image("fill")).toContain("background-size:cover")
    expect(image("fit")).toContain("background-size:contain")
    expect(image("tile")).toContain("background-repeat:repeat")
    const crop = image("crop", { crop: { x: 0.25, y: 0, w: 0.5, h: 1 }, filters: { contrast: 0.2, saturation: -0.5 } })
    expect(crop).toContain("background-size:200% 100%")
    expect(crop).toContain("background-position:50% 0%")
    expect(crop).toContain("contrast(1.2) saturate(0.5)")
    expect(
      painted(
        [shape("p", { box: spot(0, 0, 10, 10), fills: [{ kind: "image", asset: "missing", fit: "fill" }] })],
        urls,
      ),
    ).not.toContain("data-paint")
  })

  it("clips a shape to a PowerPoint preset's outline, and an ellipse to a circle", () => {
    expect(
      painted([
        shape("s", {
          box: spot(0, 0, 100, 100),
          fills: [solid(swatches.black)],
          geometry: { kind: "preset", name: "triangle" },
        }),
      ]),
    ).toMatch(/clip-path:path\("M[^"]+Z"\)/)
    expect(
      painted([
        shape("e", { box: spot(0, 0, 100, 100), fills: [solid(swatches.black)], geometry: { kind: "ellipse" } }),
      ]),
    ).toContain("border-radius:50%")
  })

  it("strokes inside by clipping a doubled stroke to the shape, and outside by masking it", () => {
    const stroked = (align: string, extra: object = {}) =>
      painted([
        shape("s", {
          box: spot(0, 0, 100, 50),
          strokes: [solid(swatches.red)],
          stroke: { weight: 4, align, dash: "solid", ...extra },
        }),
      ])
    expect(stroked("center")).toContain('stroke-width="4"')
    const inside = stroked("inside")
    expect(inside).toContain('stroke-width="8"')
    expect(inside).toContain("<clipPath")
    const outside = stroked("outside")
    expect(outside).toContain('stroke-width="8"')
    expect(outside).toContain("<mask")
    expect(stroked("center", { dash: "dash" })).toContain('stroke-dasharray="12 8"')
  })

  it("draws a line along its route with the arrow ends it names", () => {
    const line = (route: string) =>
      painted([
        shape("l", {
          geometry: {
            kind: "line",
            start: { x: 0, y: 0 },
            end: { x: 200, y: 100 },
            route,
            arrows: ["circle", "triangle"],
          },
          strokes: [solid(swatches.black)],
          stroke: { weight: 4, align: "center", dash: "solid" },
        }),
      ])
    expect(line("straight")).toContain('d="M0 0L200 100"')
    expect(line("elbow")).toContain('d="M0 0L100 0L100 100L200 100"')
    expect(line("curve")).toContain('d="M0 0C100 0 100 100 200 100"')
    const arrows = line("straight")
    expect(arrows).toContain("marker-start=")
    expect(arrows).toContain("marker-end=")
    expect(arrows.match(/<marker/g)).toHaveLength(2)
  })

  it("draws the lines the text was broken into, each at its place, with each run's look", () => {
    const html = painted([
      shape("t", {
        box: spot(10, 20, 160, 200),
        text: {
          chars: "aaaa bbbb",
          spans: [{ end: 5, bold: true, color: swatches.red }, { end: 9 }],
          paras: [{ align: "center" }],
          style: "body",
          resize: "fixed",
          alignV: "top",
        },
      }),
    ])
    expect(html.match(/data-line/g)).toHaveLength(2)
    expect(html).toContain("text-align:center")
    expect(html).toContain("font-weight:700")
    expect(html).toContain(`color:${swatches.red}`)
    expect(html).toContain("white-space:pre")
    expect(html).not.toContain("aaaa </span>")
  })

  it("nests children inside their frame and clips them only when the frame clips", () => {
    const frame = (clip: boolean) =>
      painted([
        {
          type: "frame",
          name: "f",
          props: { box: spot(0, 0, 100, 100), radius: 12, clip } as never,
          children: [shape("c", { box: spot(0, 0, 50, 50), fills: [solid(swatches.black)] })],
        },
      ])
    expect(frame(false)).not.toContain("overflow:hidden;border-radius:12px")
    expect(frame(true)).toContain("overflow:hidden;border-radius:12px")
    expect(frame(false)).toContain("data-node")
  })

  it("casts a shadow from the effect's offset, blur and colour, and blurs the layer for a layer blur", () => {
    const html = painted([
      shape("s", {
        box: spot(0, 0, 100, 100),
        fills: [solid(swatches.white)],
        effects: [{ kind: "dropShadow", color: swatches.black, opacity: 0.2, x: 0, y: 8, blur: 24, spread: 0 }],
      }),
    ])
    expect(html).toContain("box-shadow:0px 8px 24px 0px rgb(0 0 0 / 0.2)")
    expect(
      painted([
        shape("s", {
          box: spot(0, 0, 100, 100),
          fills: [solid(swatches.white)],
          effects: [{ kind: "layerBlur", radius: 8 }],
        }),
      ]),
    ).toContain("filter:blur(4px)")
    const preset = painted([
      shape("s", {
        box: spot(0, 0, 100, 100),
        fills: [solid(swatches.white)],
        geometry: { kind: "preset", name: "triangle" },
        effects: "soft",
      }),
    ])
    expect(preset).toContain("filter:drop-shadow(")
  })

  it("casts a text layer's shadow or glow from its letters, not its box", () => {
    const glow = { kind: "dropShadow", color: swatches.black, opacity: 0.5, x: 0, y: 0, blur: 28, spread: 6 }
    const html = painted([
      shape("t", {
        box: spot(0, 0, 300, 80),
        effects: [glow],
        text: { chars: "Glow", spans: [], paras: [{}], style: "body", resize: "fixed", alignV: "top" },
      }),
    ])
    expect(html).toContain("text-shadow:0px 0px 28px rgb(0 0 0 / 0.5)")
    expect(html).not.toContain("box-shadow")
  })

  it("casts an unfilled frame's shadow from what it holds", () => {
    const html = painted([
      {
        type: "frame",
        name: "f",
        props: {
          box: spot(0, 0, 200, 200),
          effects: [{ kind: "dropShadow", color: swatches.black, opacity: 0.2, x: 0, y: 8, blur: 24, spread: 0 }],
        } as never,
        children: [shape("c", { box: spot(0, 0, 50, 50), fills: [solid(swatches.black)] })],
      },
    ])
    expect(html).toContain("filter:drop-shadow(0px 8px 12px rgb(0 0 0 / 0.2))")
    expect(html).not.toContain("box-shadow")
  })

  it("paints an inner shadow inside a preset's or a path's outline", () => {
    const inner = { kind: "innerShadow", color: swatches.black, opacity: 0.3, x: 2, y: 4, blur: 10, spread: 0 }
    const preset = painted([
      shape("s", {
        box: spot(0, 0, 100, 100),
        fills: [solid(swatches.white)],
        geometry: { kind: "preset", name: "triangle" },
        effects: [inner],
      }),
    ])
    const id = /<filter id="([^"]+)"/.exec(preset)?.[1]
    expect(id).toBeDefined()
    expect(preset).toContain(`filter:url(#${id!})`)
    expect(preset).toContain('<feOffset in="SourceAlpha" dx="2" dy="4"')
    expect(preset).toContain('stdDeviation="5"')
    expect(preset).toContain('flood-opacity="0.3"')
    const path = painted([
      shape("p", {
        box: spot(0, 0, 100, 100),
        fills: [solid(swatches.white)],
        geometry: { kind: "path", d: "M0 0 L100 0 L50 100 Z" },
        effects: [inner],
      }),
    ])
    expect(path).toContain(`filter:url(#${id!})`)
  })

  it("turns a node by its rotation and mirrors its drawing by its flips", () => {
    const html = painted([
      shape("s", { box: spot(0, 0, 100, 100, { rotation: 15, flipH: true }), fills: [solid(swatches.black)] }),
    ])
    expect(html).toContain("transform:rotate(15deg)")
    expect(html).toContain("transform:scale(-1, 1)")
  })

  it("draws an icon as stroked Lucide paths, its weight kept in the box's pixels", async () => {
    await loadIcon("lucide/arrow-right")
    const html = painted([
      shape("i", {
        box: spot(0, 0, 48, 48),
        geometry: { kind: "icon", name: "lucide/arrow-right" },
        strokes: [solid(navy)],
        stroke: { weight: 4, align: "center", dash: "solid" },
      }),
    ])
    expect(html).toContain('viewBox="0 0 24 24"')
    expect(html).toContain(`stroke="${navy}"`)
    expect(html).toContain('stroke-width="2"')
    expect(html).toContain('d="M5 12h14"')
  })

  it("paints an icon that has not loaded yet as nothing, and a name Lucide lacks the same", async () => {
    await loadIcon("lucide/no-such-icon-anywhere")
    const html = painted([
      shape("i", {
        box: spot(0, 0, 48, 48),
        geometry: { kind: "icon", name: "lucide/no-such-icon-anywhere" },
        strokes: [solid(swatches.black)],
        stroke: { weight: 2, align: "center", dash: "solid" },
      }),
    ])
    expect(html).not.toContain("<path")
  })
})

describe("NodeArt for a picture whose bytes are not on this device yet", () => {
  const image = { kind: "image", asset: "a".repeat(64), fit: "fill" }
  const words = "Image is still uploading from another device"

  it("says the picture is still uploading, centred in its box", () => {
    const html = painted([shape("p", { box: spot(0, 0, 600, 300), fills: [image] })], () => undefined, words)
    expect(html).toContain("data-unshown-label")
    expect(html).toContain(words)
    expect(html).toContain("var(--placeholder-prompt)")
    expect(html).toContain("background:var(--line)")
  })

  it("says nothing once the bytes are here", () => {
    const html = painted([shape("p", { box: spot(0, 0, 600, 300), fills: [image] })], () => "blob:1", words)
    expect(html).not.toContain("data-unshown-label")
    expect(html).not.toContain("var(--line)")
  })

  it("says nothing in a box too small to hold the words", () => {
    const html = painted([shape("p", { box: spot(0, 0, 200, 60), fills: [image] })], () => undefined, words)
    expect(html).not.toContain("data-unshown-label")
    expect(html).toContain("background:var(--line)")
  })

  it("says nothing where the caller gave no words, as in a thumbnail", () => {
    const html = painted([shape("p", { box: spot(0, 0, 600, 300), fills: [image] })])
    expect(html).not.toContain("data-unshown-label")
  })

  it("says nothing for a colour fill", () => {
    const html = painted(
      [shape("p", { box: spot(0, 0, 600, 300), fills: [solid({ var: "accent1" })] })],
      () => undefined,
      words,
    )
    expect(html).not.toContain("data-unshown-label")
  })
})
