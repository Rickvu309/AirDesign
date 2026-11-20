import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { compositeOver, parseCssColor, rgbaToHex, sampleSlideColor } from "@/editor/slide-color-sample"

let domWindow: Window & typeof globalThis

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  domWindow = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  for (const [name, value] of [
    ["window", domWindow],
    ["document", domWindow.document],
    ["HTMLElement", domWindow.HTMLElement],
    ["Element", domWindow.Element],
    ["getComputedStyle", domWindow.getComputedStyle.bind(domWindow)],
  ] as const)
    vi.stubGlobal(name, value)
})

afterAll(() => {
  vi.unstubAllGlobals()
  domWindow.close()
})

function boxOf(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function setRect(node: Element, left: number, top: number, width: number, height: number) {
  Object.defineProperty(node, "getBoundingClientRect", {
    configurable: true,
    value: () => boxOf(left, top, width, height),
  })
}

const hex = (digits: string) => `#${digits}`

describe("parseCssColor and compositing", () => {
  it("parses hex, rgb, rgba, and srgb colors and composites alpha over the background", () => {
    expect(parseCssColor(hex("dc2626"))).toEqual({ r: 220, g: 38, b: 38, a: 1 })
    expect(parseCssColor(hex("0f8"))).toEqual({ r: 0, g: 255, b: 136, a: 1 })
    expect(parseCssColor("rgb(30, 64, 175)")).toEqual({ r: 30, g: 64, b: 175, a: 1 })
    expect(parseCssColor("rgba(255, 0, 0, 0.5)")).toEqual({ r: 255, g: 0, b: 0, a: 0.5 })
    expect(parseCssColor("color(srgb 1 0 0.5 / 50%)")).toEqual({ r: 255, g: 0, b: 127.5, a: 0.5 })
    const mixed = compositeOver({ r: 255, g: 0, b: 0, a: 0.5 }, { r: 0, g: 0, b: 255, a: 1 })
    expect(rgbaToHex(mixed)).toBe("800080")
  })
})

describe("sampleSlideColor", () => {
  it("samples shapes, stacked overlays, ellipses, SVG fills, gradients, text, and slide backgrounds", () => {
    const slide = document.createElement("div")
    slide.setAttribute("data-slide-paint", "")
    slide.style.backgroundColor = "rgb(240, 240, 240)"
    setRect(slide, 0, 0, 600, 400)

    const solid = document.createElement("div")
    solid.setAttribute("data-canvas-element", "solid")
    solid.style.backgroundColor = "rgb(220, 38, 38)"
    setRect(solid, 20, 20, 100, 100)
    slide.append(solid)

    const translucent = document.createElement("div")
    translucent.setAttribute("data-canvas-element", "translucent")
    translucent.style.backgroundColor = "rgba(0, 0, 255, 0.5)"
    setRect(translucent, 60, 20, 100, 100)
    slide.append(translucent)

    const ellipse = document.createElement("div")
    ellipse.setAttribute("data-canvas-element", "ellipse")
    ellipse.style.backgroundColor = "rgb(22, 163, 74)"
    ellipse.style.borderRadius = "50%"
    setRect(ellipse, 200, 20, 100, 100)
    slide.append(ellipse)

    const svgLayer = document.createElement("div")
    svgLayer.setAttribute("data-canvas-element", "svg")
    setRect(svgLayer, 320, 20, 100, 100)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("data-canvas-line", "")
    setRect(svg, 320, 20, 100, 100)
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("fill", hex("1E40AF"))
    setRect(path, 320, 20, 100, 100)
    svg.append(path)
    svgLayer.append(svg)
    slide.append(svgLayer)

    const gradientLayer = document.createElement("div")
    gradientLayer.setAttribute("data-canvas-element", "gradient")
    setRect(gradientLayer, 20, 160, 100, 100)
    const fillLayer = document.createElement("div")
    fillLayer.setAttribute("data-fill-layer", "0")
    setRect(fillLayer, 20, 160, 100, 100)
    const fillPaint = document.createElement("div")
    fillPaint.style.backgroundImage = "linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)"
    setRect(fillPaint, 20, 160, 100, 100)
    fillLayer.append(fillPaint)
    gradientLayer.append(fillLayer)
    slide.append(gradientLayer)

    const textLayer = document.createElement("div")
    textLayer.setAttribute("data-canvas-element", "text")
    setRect(textLayer, 200, 160, 160, 60)
    const paragraph = document.createElement("div")
    paragraph.setAttribute("data-paragraph", "0")
    const span = document.createElement("span")
    span.textContent = "Headline"
    span.style.color = "rgb(147, 51, 234)"
    Object.defineProperty(span, "getClientRects", {
      configurable: true,
      value: () => [boxOf(210, 170, 80, 24)],
    })
    paragraph.append(span)
    textLayer.append(paragraph)
    slide.append(textLayer)

    document.body.append(slide)
    try {
      expect(sampleSlideColor(slide, 650, 10)).toBeNull()
      expect(sampleSlideColor(slide, 550, 350)).toBe("F0F0F0")
      expect(sampleSlideColor(slide, 40, 50)).toBe("DC2626")
      expect(sampleSlideColor(slide, 80, 50)).toBe("6E1393")
      expect(sampleSlideColor(slide, 250, 70)).toBe("16A34A")
      expect(sampleSlideColor(slide, 202, 22)).toBe("F0F0F0")
      expect(sampleSlideColor(slide, 360, 60)).toBe("1E40AF")
      expect(sampleSlideColor(slide, 20, 200)).toBe("FF0000")
      expect(sampleSlideColor(slide, 70, 200)).toBe("800080")
      expect(sampleSlideColor(slide, 120, 200)).toBe("0000FF")
      expect(sampleSlideColor(slide, 230, 180)).toBe("9333EA")
      expect(sampleSlideColor(slide, 340, 180)).toBe("F0F0F0")
    } finally {
      slide.remove()
    }
  })
})
