import { describe, expect, it } from "vitest"
import {
  type Box,
  type Point,
  defaultTheme,
  isRefusal,
  measureWith,
  type Resolved,
  resolveSlide,
  siteSpot,
  solveLayout,
} from "../index.js"
import {
  architectureComponent,
  cycleComponent,
  expandComponent,
  processComponent,
  type ComponentInput,
  type ComponentNode,
  type ComponentSpec,
  type ComponentTree,
} from "./index.js"
import architecture from "./testing/architecture.json" with { type: "json" }
import cycle from "./testing/cycle.json" with { type: "json" }
import { landTree, writeProps } from "./testing/land-tree.js"
import process from "./testing/process.json" with { type: "json" }

const measure = measureWith({})
const expand = (spec: ComponentSpec, input: Omit<ComponentInput, "theme" | "measure">): ComponentTree => {
  const tree = expandComponent(spec, { theme: defaultTheme, measure, ...input })
  if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
  return tree
}
const role = (tree: ComponentTree, name: string) => tree.children.filter((node) => node.key[0] === name)
const keyed = (tree: ComponentTree, ...key: string[]) => {
  const found = tree.children.find((node) => node.key.join("/") === key.join("/"))
  if (found === undefined) throw new Error(`No part ${key.join("/")}`)
  return found
}
const ends = (node: ComponentNode) => {
  const geometry = node.props.geometry
  if (geometry.kind !== "line" || !("node" in geometry.start) || !("node" in geometry.end))
    throw new Error(`${node.key.join("/")} is not an attached line`)
  return { start: geometry.start, end: geometry.end, route: geometry.route }
}
const steps = (count: number, label = (i: number) => `Step ${i + 1}`) => ({
  steps: Array.from({ length: count }, (_, i) => ({ id: `s${i}`, label: label(i) })),
})
const sizes = (nodes: readonly ComponentNode[]) =>
  new Set(nodes.map((node) => node.props.text?.spans[0]?.size ?? defaultTheme.textStyles.label.size))

function resolvedById(doomTree: readonly Resolved[]): ReadonlyMap<string, Resolved> {
  const found = new Map<string, Resolved>()
  const walk = (nodes: readonly Resolved[]) => {
    for (const node of nodes) {
      found.set(node.id, node)
      walk(node.children)
    }
  }
  walk(doomTree)
  return found
}

const spot = (box: Box, site: "t" | "r" | "b" | "l" | "c") => {
  const at = siteSpot({ kind: "rect" }, box.w, box.h, site)
  return { x: box.x + at.x, y: box.y + at.y }
}

describe("process diagram", () => {
  it.each([3, 4, 5, 6, 7, 8])("lays %i steps in an auto layout row joined by attached connectors", (count) => {
    const tree = expand(processComponent, { frame: process.frame, data: steps(count) })
    const cards = role(tree, "step")
    expect(cards).toHaveLength(count)
    expect(role(tree, "connector")).toHaveLength(count - 1)
    expect(tree.props.layout).toMatchObject({ mode: "row", align: "center-center" })
    for (const [i, card] of cards.slice(0, -1).entries()) {
      expect(ends(keyed(tree, "connector", `s${i}`))).toEqual({
        start: { node: card.id, site: "r" },
        end: { node: cards[i + 1]!.id, site: "l" },
        route: "straight",
      })
    }
    expect(tree.findings).toEqual([])
  })

  it("stores each step where the frame's auto layout paints it", () => {
    for (const variant of [{ direction: "row" }, { direction: "column" }]) {
      const frame = variant.direction === "row" ? process.frame : { x: 600, y: 160, w: 720, h: 800 }
      const tree = expand(processComponent, { frame, data: steps(5), variant })
      const { doom, slide } = landTree(tree)
      const boxes = solveLayout(doom, slide, measure)
      for (const card of role(tree, "step")) {
        const solved = boxes.get(card.id)
        const stored = card.props.box
        expect(Math.abs((solved?.x ?? NaN) - stored.x)).toBeLessThanOrEqual(1)
        expect(Math.abs((solved?.y ?? NaN) - stored.y)).toBeLessThanOrEqual(1)
        expect([solved?.w, solved?.h]).toEqual([stored.w, stored.h])
      }
    }
  })

  it("stacks a column process with connectors from bottom to top", () => {
    const tree = expand(processComponent, {
      frame: { x: 600, y: 160, w: 720, h: 800 },
      data: steps(4),
      variant: { direction: "column" },
    })
    const [first, second] = role(tree, "step")
    expect(tree.props.layout).toMatchObject({ mode: "column" })
    expect(ends(keyed(tree, "connector", "s0"))).toMatchObject({
      start: { node: first!.id, site: "b" },
      end: { node: second!.id, site: "t" },
    })
    expect(second!.props.box.y).toBeGreaterThan(first!.props.box.y + first!.props.box.h)
  })

  it("shrinks every step label together when one label is long", () => {
    const tree = expand(processComponent, {
      frame: process.frame,
      data: steps(6, (i) => (i === 2 ? "Validate the operating model" : `Step ${i + 1}`)),
    })
    const cards = role(tree, "step")
    expect(cards).toHaveLength(6)
    expect(new Set(cards.map((card) => card.props.text?.spans[1]?.size))).toEqual(new Set([26]))
    expect(tree.findings).toEqual([])
  })

  it.each([3, 4, 5, 6, 7, 8])("fits %i steps in a column", (count) => {
    const tree = expand(processComponent, {
      frame: { x: 600, y: 160, w: 720, h: 800 },
      data: steps(count),
      variant: { direction: "column" },
    })
    expect(tree.findings).toEqual([])
    expect(role(tree, "step")).toHaveLength(count)
  })

  it("paints the step number, title and optional description", () => {
    const tree = expand(processComponent, {
      ...process,
      data: {
        steps: [
          { id: "first", label: "Discover", description: "Map needs" },
          { id: "next", label: "Define" },
        ],
      },
    })
    expect(keyed(tree, "step", "first").props.text?.chars).toBe("01\nDiscover\nMap needs")
    expect(keyed(tree, "step", "next").props.text?.chars).toBe("02\nDefine")
  })

  it.each(["process", "cycle", "architecture"])(
    "keeps an impossible %s label editable and paints an ellipsis inside the card",
    (name) => {
      const label = "W".repeat(120)
      const [tree, key, connectors] =
        name === "architecture"
          ? [
              expand(architectureComponent, {
                ...architecture,
                data: {
                  ...architecture.data,
                  components: architecture.data.components.map((c) => (c.id === "gateway" ? { ...c, name: label } : c)),
                },
              }),
              ["component", "gateway"],
              9,
            ]
          : name === "process"
            ? [
                expand(processComponent, { frame: process.frame, data: steps(8, (i) => (i === 4 ? label : "Step")) }),
                ["step", "s4"],
                7,
              ]
            : [
                expand(cycleComponent, { frame: cycle.frame, data: steps(6, (i) => (i === 4 ? label : "Step")) }),
                ["step", "s4"],
                6,
              ]
      const card = keyed(tree, ...key)
      expect(card.props.text?.chars).toContain(label)
      const { doom, slide } = landTree(tree)
      const painted = resolvedById(resolveSlide(doom, slide, measure)).get(card.id)
      expect(painted?.text?.lines.map(({ runs }) => runs.map(({ text }) => text).join("")).join("\n")).toMatch(/…$/)
      expect(
        painted?.text?.sourceLines
          ?.at(-1)
          ?.runs.map(({ text }) => text)
          .join(""),
      ).toBe(label)
      for (const line of painted?.text?.lines ?? []) {
        expect(line.ink).toBeLessThanOrEqual(line.w)
        expect(line.y + line.h).toBeLessThanOrEqual(card.props.box.h)
      }
      expect(role(tree, name === "architecture" ? "link" : "connector")).toHaveLength(connectors)
      expect(tree.findings).toMatchObject([{ kind: "text-fit", key }])
    },
  )

  it("draws nothing for an empty process", () => {
    expect(expand(processComponent, { frame: process.frame, data: steps(0) }).children).toEqual([])
  })
})

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
    for (const link of role(tree, "link")) {
      const { start, end } = ends(link)
      const route = resolved.get(link.id)
      if (route?.geometry?.kind !== "line") throw new Error("Missing line")
      const points = route.geometry.points.map(({ x, y }) => ({ x: x + route.box.x, y: y + route.box.y }))
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

  it("keeps links clear in 60 seeded three-layer graphs", () => {
    let seed = 1661
    const pick = (n: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return Math.floor((seed / 2 ** 32) * n)
    }
    const layers = architecture.data.layers
    for (let graph = 0; graph < 60; graph++) {
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
      const attached =
        start.node === gateway.id ? { site: start.site, at: geometry.from } : { site: end.site, at: geometry.to }
      const box = resolved.get(link.id)!.box
      expect({ x: attached.at.x + box.x, y: attached.at.y + box.y }).toEqual(spot(moved, attached.site))
    }
  })
})

describe("cycle diagram", () => {
  it.each([3, 4, 5, 6])("places %i steps around the frame and closes the loop", (count) => {
    const tree = expand(cycleComponent, { frame: cycle.frame, data: steps(count) })
    const cards = role(tree, "step")
    expect(cards).toHaveLength(count)
    expect(role(tree, "connector")).toHaveLength(count)
    const top = cards[0]!.props.box
    expect(top.y).toBe(0)
    expect(Math.abs(top.x + top.w / 2 - cycle.frame.w / 2)).toBeLessThanOrEqual(1)
    for (const [i, card] of cards.entries()) {
      const { start, end } = ends(keyed(tree, "connector", `s${i}`))
      expect(start.node).toBe(card.id)
      expect(end.node).toBe(cards[(i + 1) % count]!.id)
      expect(start.node).not.toBe(end.node)
    }
    for (const [i, a] of cards.entries())
      for (const b of cards.slice(i + 1)) {
        const apart =
          a.props.box.x + a.props.box.w <= b.props.box.x ||
          b.props.box.x + b.props.box.w <= a.props.box.x ||
          a.props.box.y + a.props.box.h <= b.props.box.y ||
          b.props.box.y + b.props.box.h <= a.props.box.y
        expect(apart, `${a.key.join("/")} overlaps ${b.key.join("/")}`).toBe(true)
      }
  })

  it("leaves each card along the turn of the cycle", () => {
    const tree = expand(cycleComponent, cycle)
    const sites = ["plan", "build", "measure", "learn"].map((id) => {
      const { start, end } = ends(keyed(tree, "connector", id))
      return `${start.site}${end.site}`
    })
    expect(sites).toEqual(["rt", "br", "lb", "tl"])
    expect(ends(keyed(tree, "connector", "plan")).route).toBe("curve")
  })

  it("draws straight connectors as a variant", () => {
    const tree = expand(cycleComponent, { ...cycle, variant: { route: "straight" } })
    expect(role(tree, "connector").map((node) => ends(node).route)).toEqual(Array(4).fill("straight"))
  })
})
