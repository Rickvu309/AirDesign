import * as doom from "@airdesign/doom"
import { createElement, Fragment } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { paintPathFades } from "./path-fades.js"
import { testTheme } from "@airdesign/doom/testing"

function paint(alphas: readonly number[], paths = ["M0 0L1 0L1 1Z", "M0 0L1 1L0 1Z"]) {
  const children = alphas.map((opacity, i): doom.TreeNode => ({
    type: "shape",
    name: `piece ${i}`,
    props: {
      box: { x: 0, y: 0, w: 1000, h: 1000, rotation: 0, flipH: false, flipV: false },
      opacity,
      geometry: { kind: "path", d: paths[i]!, fillStroke: true },
      fills: [{ kind: "solid", color: { var: "accent1" }, opacity: 1 }],
    },
  }))
  const grown = doom.doomFromTree({ theme: testTheme, slides: [{ children }] })
  const nodes = doom.resolveSlide(grown.doom, grown.slides[0]!, doom.measureWith({}))
  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      paintPathFades(nodes, (node) => createElement("span", { key: node.id, "data-paints": node.fills.length })),
    ),
  )
}

describe("partition opacity", () => {
  it("paints opaque pieces through the normal seam stroke path", () => {
    expect(paint([1, 1])).toBe('<span data-paints="1"></span><span data-paints="1"></span>')
  })

  it("paints a uniform fade as one vector group", () => {
    const html = paint([0.5, 0.5])
    expect(html).toContain('<g opacity="0.5">')
    expect(html.match(/<path /g)).toHaveLength(2)
    expect(html).not.toMatch(/<filter|<image/)
  })

  it("layers the highlight above the common fade", () => {
    const html = paint([0.25, 0.625])
    expect(html.match(/<g opacity="[^"]+">/g)).toEqual(['<g opacity="0.25">', '<g opacity="0.5">'])
    expect(html.match(/<path /g)).toHaveLength(3)
    expect(html.match(/data-paints="0"/g)).toHaveLength(2)
  })

  it("keeps a 40-piece fan in one shared group", () => {
    const rim = (index: number) => {
      const angle = (index * Math.PI) / 20
      return `${(0.5 + 0.5 * Math.cos(angle)).toFixed(5)} ${(0.5 + 0.5 * Math.sin(angle)).toFixed(5)}`
    }
    const alphas = Array.from({ length: 40 }, () => 0.5)
    const html = paint(
      alphas,
      alphas.map((_, index) => `M0.5 0.5L${rim(index)}L${rim(index + 1)}Z`),
    )
    expect(html.match(/<g opacity="0.5">/g)).toHaveLength(1)
    expect(html.match(/<path /g)).toHaveLength(40)
  })

  it("keeps three opacity levels in vector", () => {
    const html = paint([0.25, 0.625, 1], ["M0 0L1 0L1 0.5Z", "M0 0L1 0.5L1 1Z", "M0 0L1 1L0 1Z"])
    expect(html.match(/<g opacity="[^"]+">/g)).toEqual(['<g opacity="0.25">', '<g opacity="0.5">', '<g opacity="1">'])
    expect(html.match(/<path /g)).toHaveLength(6)
    expect(html).not.toMatch(/filter|blur|image/)
  })
})
