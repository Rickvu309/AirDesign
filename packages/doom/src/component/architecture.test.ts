import { describe, expect, it } from "vitest"
import { type Box, type Point, defaultTheme, resolveSlide, siteSpot } from "../index.js"
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

  const crosses = (a: Point, b: Point, box: Box) =>
    a.y === b.y
      ? a.y > box.y && a.y < box.y + box.h && Math.max(a.x, b.x) > box.x && Math.min(a.x, b.x) < box.x + box.w
      : a.x > box.x && a.x < box.x + box.w && Math.max(a.y, b.y) > box.y && Math.min(a.y, b.y) < box.y + box.h

  function expectClear(data: typeof architecture.data) {
    const tree = expand(architectureComponent, { ...architecture, data })
    const { doom, slide } = landTree(tree)
    const resolved = resolvedById(resolveSlide(doom, slide, measure))
    const hits: string[] = []
    const routes: { id: string; nodes: readonly string[]; points: readonly Point[] }[] = []
    const overlaps = (a: Point, b: Point, c: Point, d: Point) =>
      (Math.abs(a.y - b.y) < 1e-6 &&
        Math.abs(c.y - d.y) < 1e-6 &&
        Math.abs(a.y - c.y) < 1e-6 &&
        Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > 1e-6) ||
      (Math.abs(a.x - b.x) < 1e-6 &&
        Math.abs(c.x - d.x) < 1e-6 &&
        Math.abs(a.x - c.x) < 1e-6 &&
        Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > 1e-6)
    for (const link of role(tree, "link")) {
      const { start, end } = ends(link)
      const route = resolved.get(link.id)
      if (route?.geometry?.kind !== "line") throw new Error("Missing line")
      const points = route.geometry.points.map(({ x, y }) => ({ x: x + route.box.x, y: y + route.box.y }))
      for (const other of routes) {
        if (other.nodes.includes(start.node) || other.nodes.includes(end.node)) continue
        if (
          points
            .slice(1)
            .some((b, i) => other.points.slice(1).some((d, j) => overlaps(points[i]!, b, other.points[j]!, d)))
        )
          hits.push(`${link.key[1]} overlaps ${other.id}`)
      }
      routes.push({ id: link.key[1]!, nodes: [start.node, end.node], points })
      for (const card of role(tree, "component")) {
        if (card.id === start.node || card.id === end.node) continue
        const box = resolved.get(card.id)!.box
        if (points.slice(1).some((point, i) => crosses(points[i]!, point, box)))
          hits.push(`${link.key[1]} → ${card.key[1]}`)
      }
    }
    expect(hits).toEqual([])
  }

  it("keeps skip-layer and non-neighbor links clear of cards in the verifier's examples", () => {
    expectClear({
      ...architecture.data,
      links: [
        ...architecture.data.links,
        { id: "skip", from: "mobile", to: "events" },
        { id: "lateral", from: "identity", to: "payments" },
      ],
    })
    expectClear({
      layers: architecture.data.layers,
      components: architecture.data.layers.map(({ id }) => ({ id, layer: id, name: id })),
      links: [{ id: "skip-centered", from: "channels", to: "data" }],
    })
  })

  it.each([2, 3, 4, 5])("keeps unrelated links and cards clear in seeded %i-layer graphs", (count) => {
    let seed = 1661
    const pick = (n: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return Math.floor((seed / 2 ** 32) * n)
    }
    const layers = Array.from({ length: count }, (_, i) => ({ id: `layer-${i}`, label: `Layer ${i + 1}` }))
    for (let graph = 0; graph < 20; graph++) {
      const components = layers.flatMap(({ id: layer }) =>
        Array.from({ length: 1 + pick(6) }, (_, i) => ({ id: `${layer}-${i}`, layer, name: `Service ${i + 1}` })),
      )
      const links = Array.from({ length: 16 }, (_, i) => {
        const a = pick(components.length)
        const b = (a + 1 + pick(components.length - 1)) % components.length
        return { id: `link-${i}`, from: components[a]!.id, to: components[b]!.id }
      })
      expectClear({ layers, components, links })
    }
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
