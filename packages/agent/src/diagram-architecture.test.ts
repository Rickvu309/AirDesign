import { describe, expect, it } from "vitest"

import {
  clean,
  type Drawing,
  type Line,
  near,
  overlaps,
  type Rect,
  recipe,
  refused,
  sample,
  segments,
  shared,
  styles,
  wellJoined,
  withData,
} from "./testing/diagram-drawing.js"

type System = {
  readonly direction: "down" | "right"
  readonly layers: readonly { readonly name: string; readonly boxes: readonly string[] }[]
  readonly edges: readonly (readonly [string, string])[]
  readonly path: readonly string[]
  readonly callouts: readonly (readonly [string, string])[]
}

const systemSample = (): System => ({
  direction: sample("architecture", "direction"),
  layers: sample("architecture", "layers"),
  edges: sample("architecture", "edges"),
  path: sample("architecture", "path"),
  callouts: sample("architecture", "callouts"),
})

function systemDrawn(drawing: Drawing, system: System) {
  const down = system.direction === "down"
  const boxes = system.layers.flatMap((layer) => layer.boxes.map((name) => drawing.named(name)))
  const id = new Map(boxes.map((box) => [box.name, box.id]))
  wellJoined(boxes, drawing.lines)
  expect(drawing.lines.map((line) => `${line.from} ${line.to}`).sort()).toEqual(
    system.edges.map(([a, b]) => `${id.get(a)!} ${id.get(b)!}`).sort(),
  )
  for (const [at, one] of drawing.lines.entries())
    for (const two of drawing.lines.slice(at + 1))
      for (const a of segments(one.points))
        for (const b of segments(two.points)) {
          const sameEnd = one.from === two.from || one.to === two.to
          expect(sameEnd ? 0 : shared(a, b), `${one.name} runs on ${two.name}`).toBeLessThanOrEqual(1)
        }

  const main = (box: Rect) => (down ? box.y : box.x)
  const cross = (box: Rect) => (down ? box.x : box.y)
  const size = (box: Rect) => (down ? box.h : box.w)
  let reached = -Infinity
  for (const layer of system.layers) {
    const row = layer.boxes.map((name) => drawing.named(name).box)
    for (const box of row) expect(main(box), layer.name).toBe(main(row[0]!))
    expect(main(row[0]!), layer.name).toBeGreaterThan(reached)
    reached = main(row[0]!) + size(row[0]!)
    const crossed = row.map(cross).toSorted((a, b) => a - b)
    const steps = crossed.slice(1).map((value, at) => value - crossed[at]!)
    for (const step of steps) expect(near(step, steps[0]!), layer.name).toBe(true)
    expect(main(drawing.named(layer.name).box), layer.name).toBe(main(row[0]!))
  }

  const onPath = (line: Line) =>
    system.path.some((name, at) => id.get(name) === line.from && id.get(system.path[at + 1] ?? "") === line.to)
  for (const line of drawing.lines) expect(line.stroke.includes("accent1"), line.name).toBe(onPath(line))
  for (const box of boxes) expect(box.stroke.includes("accent1"), box.name).toBe(system.path.includes(box.name))

  system.callouts.forEach(([name, takeaway], at) => {
    const markers = drawing.layers.filter((layer) => layer.name === `Callout ${String(at + 1)}`)
    expect(markers.map((marker) => marker.text)).toEqual([String(at + 1), String(at + 1)])
    const owner = drawing.named(name).box
    const [onBox, onText] = markers.map((marker) => marker.box)
    expect(overlaps(onBox!, owner), `${name} wears its number`).toBe(true)
    expect(onBox!.x + onBox!.w / 2, name).toBeLessThan(owner.x)
    expect(onBox!.y + onBox!.h / 2, name).toBeLessThan(owner.y)
    const text = drawing.named(`Takeaway ${String(at + 1)}`)
    expect(text.text).toBe(takeaway)
    expect(onText!.y).toBe(text.box.y)
    expect(onText!.x + onText!.w).toBeLessThan(text.box.x)
    for (const box of boxes) expect(onText!.x, name).toBeGreaterThan(box.box.x + box.box.w)
  })
  expect(drawing.layers.filter((layer) => layer.name.startsWith("Callout "))).toHaveLength(2 * system.callouts.length)
}

const shop: System = {
  direction: "down",
  layers: [
    { name: "Clients", boxes: ["Admin console", "Browser", "Partner API"] },
    { name: "Services", boxes: ["Checkout", "Catalog", "Search"] },
    { name: "Data", boxes: ["Products DB", "Orders DB"] },
  ],
  edges: [
    ["Browser", "Search"],
    ["Browser", "Catalog"],
    ["Browser", "Checkout"],
    ["Partner API", "Catalog"],
    ["Admin console", "Catalog"],
    ["Catalog", "Products DB"],
    ["Search", "Products DB"],
    ["Checkout", "Orders DB"],
    ["Checkout", "Products DB"],
  ],
  path: ["Browser", "Checkout", "Orders DB"],
  callouts: [["Checkout", "Checkout writes each order once, then reads stock"]],
}

const widest: System = {
  direction: "down",
  layers: [
    { name: "People", boxes: ["Web", "iOS", "Android", "Partners"] },
    { name: "Edge", boxes: ["Gateway", "Auth", "Limits", "Webhooks"] },
    { name: "Services", boxes: ["Orders", "Payments", "Accounts", "Search"] },
    { name: "Data", boxes: ["Orders DB", "Ledger", "Users DB", "Index"] },
  ],
  edges: [
    ["Web", "Gateway"],
    ["iOS", "Gateway"],
    ["Android", "Gateway"],
    ["Partners", "Webhooks"],
    ["Gateway", "Orders"],
    ["Gateway", "Payments"],
    ["Gateway", "Accounts"],
    ["Webhooks", "Search"],
    ["Orders", "Orders DB"],
    ["Payments", "Ledger"],
    ["Accounts", "Users DB"],
    ["Search", "Index"],
  ],
  path: ["iOS", "Gateway", "Payments", "Ledger"],
  callouts: [
    ["Gateway", "The gateway checks every token and every quota before a call reaches a service"],
    ["Payments", "Payments holds the card for two seconds while the bank answers, then writes once"],
    ["Ledger", "The ledger keeps each payment forever and is never edited, only appended to"],
  ],
}

const wordy: System = {
  direction: "down",
  layers: [
    { name: "Clients", boxes: ["Web shop", "Store tablets", "Partner API"] },
    { name: "Services", boxes: ["Order intake", "Stock holds", "Card capture"] },
    { name: "Data", boxes: ["Orders and returns", "Stock by site", "Payments ledger"] },
  ],
  edges: [
    ["Web shop", "Order intake"],
    ["Store tablets", "Order intake"],
    ["Partner API", "Stock holds"],
    ["Order intake", "Stock holds"],
    ["Stock holds", "Card capture"],
    ["Order intake", "Orders and returns"],
    ["Stock holds", "Stock by site"],
    ["Card capture", "Payments ledger"],
  ],
  path: ["Web shop", "Order intake", "Stock holds", "Card capture", "Payments ledger"],
  callouts: [
    ["Order intake", "Every order passes through intake, which makes it the place to cap peak load"],
    ["Payments ledger", "Payments are written once and never edited, so refunds are new rows"],
  ],
}

describe("the architecture recipe", () => {
  for (const style of styles)
    it(`draws its sample in ${style}: ordered layers, attached arrows, the path in the accent, numbered callouts`, async () => {
      systemDrawn(await clean(style, recipe("architecture")), systemSample())
    })

  for (const direction of ["down", "right"] as const)
    it(`draws a new system of 8 boxes and 9 arrows ${direction}, no arrow crossing a box or running on another`, async () => {
      const system = { ...shop, direction }
      systemDrawn(await clean("consulting", withData("architecture", system)), system)
    })

  for (const style of ["consulting", "midnight"]) {
    it(`holds 4 layers of 4 boxes and 3 long callouts in ${style}`, async () => {
      systemDrawn(await clean(style, withData("architecture", widest)), widest)
    })

    for (const direction of ["down", "right"] as const)
      it(`holds names of three words and long callouts ${direction} in ${style}`, async () => {
        const system = { ...wordy, direction }
        systemDrawn(await clean(style, withData("architecture", system)), system)
      })
  }

  it("holds the smallest system: 2 layers of 1 box, one arrow, no callouts, either way", async () => {
    for (const direction of ["down", "right"] as const) {
      const system: System = {
        direction,
        layers: [
          { name: "Clients", boxes: ["App"] },
          { name: "Data", boxes: ["Store"] },
        ],
        edges: [["App", "Store"]],
        path: ["App", "Store"],
        callouts: [],
      }
      systemDrawn(await clean("neutral", withData("architecture", system)), system)
    }
  })

  it("stops with a sentence the agent can act on when an arrow would skip a layer or the path leaves the edges", async () => {
    const skipping = { ...shop, edges: [...shop.edges, ["Browser", "Orders DB"]] }
    expect(await refused(withData("architecture", skipping))).toContain("Browser to Orders DB would cross other boxes")
    const astray = { ...shop, path: ["Browser", "Orders DB"] }
    expect(await refused(withData("architecture", astray))).toContain(
      "The path goes from Browser to Orders DB, which no edge joins",
    )
  })
})
