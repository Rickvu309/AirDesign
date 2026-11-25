import { describe, expect, it } from "vitest"
import { type Box, defaultTheme, resolveSlide, siteSpot } from "../index.js"
import { architectureComponent, type ComponentNode } from "./index.js"
import architecture from "./testing/architecture.json" with { type: "json" }
import { ends, expand, keyed, measure, resolvedById, role } from "./testing/diagram-tree.js"
import { landTree, writeProps } from "./testing/land-tree.js"

const sizes = (nodes: readonly ComponentNode[]) =>
  new Set(nodes.map((node) => node.props.text?.spans[0]?.size ?? defaultTheme.textStyles.label.size))

const spot = (box: Box, site: "t" | "r" | "b" | "l" | "c", along?: number) => {
  const at = siteSpot({ kind: "rect" }, box.w, box.h, site, along)
  return { x: box.x + at.x, y: box.y + at.y }
}

describe("architecture diagram", () => {
  it("draws a band and label per layer, a card per component and an attached connector per link", () => {
    const tree = expand(architectureComponent, architecture)
    expect(role(tree, "band")).toHaveLength(3)
    expect(role(tree, "layer").map((node) => node.props.text?.chars)).toEqual(["Channels", "Services", "Data"])
    expect(role(tree, "component")).toHaveLength(10)
    expect(role(tree, "link")).toHaveLength(9)
    expect(tree.findings).toEqual([])
    const bands = role(tree, "band").map((node) => node.props.box)
    for (const [i, band] of bands.slice(1).entries()) expect(band.y).toBeGreaterThan(bands[i]!.y + bands[i]!.h)
  })

  it("attaches links on the sides that face each other", () => {
    const data = {
      ...architecture.data,
      links: [
        { id: "down", from: "web", to: "gateway" },
        { id: "up", from: "postgres", to: "orders" },
        { id: "right", from: "gateway", to: "orders" },
        { id: "left", from: "gateway", to: "identity" },
      ],
    }
    const tree = expand(architectureComponent, { ...architecture, data })
    const sites = (id: string) => {
      const { start, end } = ends(keyed(tree, "link", id))
      return [start.site, end.site]
    }
    expect(sites("down")).toEqual(["b", "t"])
    expect(sites("up")).toEqual(["t", "b"])
    expect(sites("right")).toEqual(["r", "l"])
    expect(sites("left")).toEqual(["l", "r"])
    expect(ends(keyed(tree, "link", "down")).route).toBe("elbow")
  })

  it("keeps an empty layer as a labelled band", () => {
    const data = {
      ...architecture.data,
      layers: [...architecture.data.layers, { id: "ops", label: "Operations" }],
    }
    const tree = expand(architectureComponent, { ...architecture, data })
    expect(keyed(tree, "band", "ops").props.box.h).toBeGreaterThan(0)
    expect(keyed(tree, "layer", "ops").props.text?.chars).toBe("Operations")
    expect(role(tree, "component")).toHaveLength(10)
  })

  it("draws only bands for layers with no components and no links", () => {
    const tree = expand(architectureComponent, {
      frame: architecture.frame,
      data: { layers: architecture.data.layers, components: [], links: [] },
    })
    expect(tree.children.map((node) => node.key[0])).toEqual(["band", "layer", "band", "layer", "band", "layer"])
  })

  it("fits long component names to one size and keeps every card", () => {
    const data = {
      ...architecture.data,
      components: architecture.data.components.map((component) =>
        component.id === "gateway" ? { ...component, name: "Regional API gateway and rate limiter" } : component,
      ),
    }
    const tree = expand(architectureComponent, { ...architecture, data })
    expect(role(tree, "component")).toHaveLength(10)
    expect(sizes(role(tree, "component"))).toEqual(new Set([18]))
  })

  it("keeps each connector attached when a person moves a card", () => {
    const tree = expand(architectureComponent, architecture)
    const gateway = keyed(tree, "component", "gateway")
    const { doom, slide } = landTree(tree)
    const moved = { ...gateway.props.box, x: gateway.props.box.x + 220, y: gateway.props.box.y + 30 }
    const after = writeProps(doom, [{ node: gateway.id, prop: "box", value: moved }])
    const resolved = resolvedById(resolveSlide(after, slide, measure))
    for (const id of ["web", "mobile", "partners", "auth", "route"]) {
      const link = keyed(tree, "link", id)
      const geometry = resolved.get(link.id)?.geometry
      if (geometry?.kind !== "line") throw new Error(`No painted line ${id}`)
      const { start, end } = ends(link)
      const attached = start.node === gateway.id ? { ...start, at: geometry.from } : { ...end, at: geometry.to }
      const box = resolved.get(link.id)!.box
      expect({ x: attached.at.x + box.x, y: attached.at.y + box.y }).toEqual(spot(moved, attached.site, attached.along))
    }
  })
})
