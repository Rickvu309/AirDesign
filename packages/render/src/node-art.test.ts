import * as doom from "@airdesign/doom"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadIcon } from "./icon-nodes.js"
import { NodeArt } from "./node-art.js"
import { swatches } from "./testing/swatches-art.js"
import { testTheme } from "@airdesign/doom/testing"

const navy = testTheme.colors.accent1

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
  const grown = doom.doomFromTree({ theme: testTheme, slides: [{ children: nodes }] })
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
  it("extends the fill of a path when its own paint is opaque, including inside a faded group", () => {
    const path = (opacity = 1, alpha = 1) =>
      shape("wedge", {
        box: spot(0, 0, 100, 100),
        geometry: { kind: "path", d: "M0 0L1 0L1 1Z", fillStroke: true },
        opacity,
        fills: [solid({ var: "accent1" }, { opacity: alpha })],
      })
    expect(painted([path()])).toContain(`stroke="${navy}"`)
    expect(painted([path(0.5)])).not.toContain("stroke-width")
    expect(painted([path(1, 0.5)])).not.toContain("stroke-width")
    expect(
      painted([
        {
          type: "frame",
          props: { box: spot(0, 0, 100, 100), opacity: 0.5 },
          children: [{ type: "frame", props: { box: spot(0, 0, 100, 100) }, children: [path()] }],
        },
      ]),
    ).toContain('stroke-width="2"')
  })

  it("paints a translucent solid path directly even without fillStroke", () => {
    const html = painted([
      shape("triangle", {
        box: spot(0, 0, 100, 100),
        geometry: { kind: "path", d: "M0 0L1 0L1 1Z" },
        fills: [solid({ var: "accent1" }, { opacity: 0.5 })],
      }),
    ])
    expect(html).toContain(`<path d="M0 0L100 0L100 100Z" fill="${navy}"`)
    expect(html).not.toContain("clip-path")
    expect(html).not.toContain("stroke-width")
  })

  it("fades adjacent wedge fills together and overlapping wedge fills separately", () => {
    const wedge = (d: string) =>
      shape("wedge", {
        box: spot(0, 0, 100, 100),
        geometry: { kind: "path", d, fillStroke: true },
        fills: [solid({ var: "accent1" })],
        opacity: 0.5,
      })
    const upper = "M0 0.5A0.5 0.5 0 0 1 1 0.5L0.5 0.5Z"
    const lower = "M1 0.5A0.5 0.5 0 0 1 0 0.5L0.5 0.5Z"
    const frame = (d: string): doom.TreeNode => ({
      type: "frame",
      props: { box: spot(0, 0, 100, 100) },
      children: [wedge(upper), wedge(d)],
    })
    const html = (d: string) => painted([frame(d)])
    expect(html(lower)).toContain('<g opacity="0.5"')
    expect(html(upper)).not.toContain("<g")
    expect(html(upper).match(/opacity:0\.5/g)).toHaveLength(2)
  })

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
        box: spot(10, 20, 120, 200),
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

  it("underlines linked words, as on the slide in Present, and only those words", () => {
    const html = painted([
      shape("t", {
        box: spot(0, 0, 900, 80),
        text: {
          chars: "Read the report now",
          spans: [{ end: 9 }, { end: 15, link: "https://example.com/report" }, { end: 19 }],
          paras: [{}],
          style: "body",
          resize: "fixed",
          alignV: "top",
        },
      }),
    ])
    const runs = [...html.matchAll(/<span data-run=""([^>]*)>([^<]*)<\/span>/g)].map(([, attributes, text]) => ({
      text,
      underlined: attributes!.includes("text-decoration:underline"),
    }))
    expect(runs).toEqual([
      { text: "Read the ", underlined: false },
      { text: "report", underlined: true },
      { text: " now", underlined: false },
    ])
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
    const glow = { kind: "dropShadow", color: swatches.black, opacity: 0.5, x: 0, y: 0, blur: 28, spread: 0 }
    const html = painted([
      shape("t", {
        box: spot(0, 0, 300, 80),
        effects: [glow],
        text: { chars: "Glow", spans: [], paras: [{}], style: "body", resize: "fixed", alignV: "top" },
      }),
    ])
    expect(html).toContain("filter:drop-shadow(0px 0px 14px rgb(0 0 0 / 0.5))")
    expect(html).not.toContain("box-shadow")
  })

  it("while a text layer is edited, shadows only its letters, never the caret or the selection", () => {
    const shadow = { kind: "dropShadow", color: swatches.black, opacity: 0.5, x: 4, y: 6, blur: 0, spread: 0 }
    const inner = { kind: "innerShadow", color: swatches.black, opacity: 0.3, x: 0, y: 2, blur: 4, spread: 0 }
    const words = { chars: "Edit", spans: [], paras: [{}], style: "body", resize: "fixed", alignV: "top" }
    const grown = doom.doomFromTree({
      theme: testTheme,
      slides: [{ children: [shape("t", { box: spot(0, 0, 300, 80), effects: [shadow, inner], text: words })] }],
    })
    const [node] = doom.resolveSlide(grown.doom, grown.slides[0]!, doom.measureWith({}))
    const html = renderToStaticMarkup(
      createElement(NodeArt, {
        node: node!,
        assetUrl: () => undefined,
        host: { id: node!.id, render: () => createElement("div", { "data-text-editor": "" }) },
      }),
    ).replaceAll("&quot;", '"')
    expect(html).toContain("text-shadow:4px 6px 0px rgb(0 0 0 / 0.5)")
    expect(html).not.toContain("filter:")
    expect(html).not.toContain("<filter")
  })

  it("spreads a shadow only on a filled rectangle, ellipse or frame, as Figma does", () => {
    const spread = { kind: "dropShadow", color: swatches.black, opacity: 0.5, x: 0, y: 0, blur: 20, spread: 6 }
    const words = { chars: "Glow", spans: [], paras: [{}], style: "body", resize: "fixed", alignV: "top" }
    expect(
      painted([shape("r", { box: spot(0, 0, 100, 100), fills: [solid(swatches.white)], effects: [spread] })]),
    ).toContain("box-shadow:0px 0px 20px 6px rgb(0 0 0 / 0.5)")
    for (const unspread of [
      shape("t", { box: spot(0, 0, 300, 80), effects: [spread], text: words }),
      shape("p", {
        box: spot(0, 0, 100, 100),
        fills: [solid(swatches.white)],
        geometry: { kind: "preset", name: "triangle" },
        effects: [spread],
      }),
    ])
      expect(painted([unspread])).toContain("drop-shadow(0px 0px 10px rgb(0 0 0 / 0.5))")
  })

  it("paints an inner shadow inside a text layer's letters", () => {
    const inner = { kind: "innerShadow", color: swatches.black, opacity: 0.3, x: 0, y: 2, blur: 4, spread: 0 }
    const html = painted([
      shape("t", {
        box: spot(0, 0, 300, 80),
        effects: [inner],
        text: { chars: "Deep", spans: [], paras: [{}], style: "body", resize: "fixed", alignV: "top" },
      }),
    ])
    const id = /<filter id="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeDefined()
    expect(html).toContain(`filter:url(#${id!})`)
  })

  it("gives each layer its own inner shadow filter, so one hidden copy cannot blank the others", () => {
    const inner = { kind: "innerShadow", color: swatches.black, opacity: 0.3, x: 2, y: 4, blur: 10, spread: 0 }
    const layer = (name: string, x: number) =>
      shape(name, {
        box: spot(x, 0, 100, 100),
        fills: [solid(swatches.white)],
        geometry: { kind: "preset", name: "triangle" },
        effects: [inner],
      })
    const ids = [...painted([layer("a", 0), layer("b", 200)]).matchAll(/<filter id="([^"]+)"/g)].map(
      (match) => match[1],
    )
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
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
