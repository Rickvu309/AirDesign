import * as doom from "@airdesign/doom"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DoomSlide } from "./index.js"

const roots: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) await act(async () => root.unmount())
})

const spot = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, rotation: 0, flipH: false, flipV: false })

describe("DoomSlide", () => {
  it("paints the slide at the width it is given, scaled from the deck's size, once its text is measured", async () => {
    const grown = doom.doomFromTree({
      theme: doom.defaultTheme,
      slides: [
        {
          children: [
            {
              type: "shape",
              name: "words",
              props: {
                box: spot(100, 100, 600, 100),
                text: { chars: "Revenue", spans: [], paras: [{}], style: "title", resize: "height", alignV: "top" },
              },
            },
            {
              type: "shape",
              name: "box",
              props: { box: spot(100, 300, 200, 100), fills: [{ kind: "solid", color: { var: "accent1" } }] },
            },
          ],
        },
      ],
    })
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    roots.push(root)
    await act(async () =>
      root.render(createElement(DoomSlide, { doom: grown.doom, slide: grown.slides[0]!, width: 960 })),
    )
    const slide = host.querySelector<HTMLElement>("[data-doom-slide]")
    expect(slide?.style.width).toBe("960px")
    expect(slide?.style.height).toBe("540px")
    expect(host.querySelector("[data-fonts-pending]")).toBeNull()
    expect(host.querySelectorAll("[data-node]")).toHaveLength(2)
    expect(host.querySelector("[data-line]")?.textContent).toBe("Revenue")
    expect(slide?.firstElementChild?.getAttribute("style")).toContain("scale(0.5)")
  })
})

describe("DoomSlide widths in a deck that mixes fonts", () => {
  it("lays out words in one font with that font's own widths, whichever slide was painted first", async () => {
    const words = (chars: string, font?: string) => ({
      type: "shape" as const,
      name: "words",
      props: {
        box: spot(100, 100, 600, 100),
        text: {
          chars,
          spans: font === undefined ? [] : [{ end: chars.length, font }],
          paras: [{}],
          style: "body" as const,
          resize: "widthAndHeight" as const,
          alignV: "top" as const,
        },
      },
    })
    const grown = doom.doomFromTree({
      theme: doom.defaultTheme,
      slides: [
        { children: [words("Café")] },
        { children: [words("OPENING", "Lora")] },
        { children: [words("Café", "Lora")] },
      ],
    })
    const context = {
      font: "",
      fontKerning: "",
      textRendering: "",
      measureText(text: string) {
        const advance = this.font.includes("Lora") ? 18 : 12
        return { width: advance * [...text].length, fontBoundingBoxAscent: 20, fontBoundingBoxDescent: 5 }
      },
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D)
    Object.defineProperty(document, "fonts", { configurable: true, value: { load: async () => [], check: () => true } })
    const lineWidth = async (slide: doom.NodeId) => {
      const host = document.createElement("div")
      document.body.append(host)
      const root = createRoot(host)
      roots.push(root)
      await act(async () => root.render(createElement(DoomSlide, { doom: grown.doom, slide, width: 1920 })))
      return host.querySelector<HTMLElement>("[data-line]")?.style.width
    }
    const [inter, lora, both] = grown.slides
    await lineWidth(inter!)
    await lineWidth(lora!)
    const painted = await lineWidth(both!)
    const wholeDeck = doom.measureWith({
      [doom.fontFace("Lora", false, false)]: {
        ascent: 20 / 32,
        descent: 5 / 32,
        advances: Object.fromEntries([..."Café"].map((char) => [char, 18 / 32])),
        kerning: {},
      },
    })
    const wanted = doom.resolveSlide(grown.doom, both!, wholeDeck)[0]?.text?.lines[0]?.w
    expect(wanted).toBeGreaterThan(0)
    expect(painted).toBe(`${String(wanted)}px`)
  })
})
