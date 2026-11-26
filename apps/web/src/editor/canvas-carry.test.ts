import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { carriedTo, dropWrites, liftOf, slideTargets } from "./canvas-carry"
import { carryOver } from "./grid-carry"
import { gridLayout } from "./grid-lines"
import { geometryOf } from "./slide-geometry"
import { landed, paint, spot } from "./testing/doom-fixtures"

const size = { w: 1920, h: 1080 }
const line = (named: Readonly<Record<string, doom.NodeId>>) => ({
  box: spot(300, 160, 300, 0),
  geometry: {
    kind: "line" as const,
    start: { node: named.a!, site: "r" as const },
    end: { node: named.b!, site: "l" as const },
    route: "straight" as const,
    arrows: ["none", "none"] as const,
  },
})

function twoSlides() {
  const grown = doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        children: [
          { type: "shape", name: "a", props: { box: spot(100, 100, 200, 120), fills: paint } },
          { type: "shape", name: "b", props: { box: spot(600, 100, 200, 120), fills: paint } },
          { type: "shape", name: "joint", props: line },
          {
            type: "frame",
            name: "turned",
            props: { box: spot(900, 500, 400, 300, 90) },
            children: [{ type: "shape", name: "inner", props: { box: spot(20, 20, 100, 60), fills: paint } }],
          },
          { type: "shape", name: "held", props: { box: spot(1500, 800, 100, 100), fills: paint, locked: true } },
        ],
      },
      { children: [{ type: "shape", name: "there", props: { box: spot(1000, 400, 200, 200), fills: paint } }] },
    ],
  })
  const measure = doom.measureWith({})
  const [from, to] = grown.slides as [doom.NodeId, doom.NodeId]
  const geometry = geometryOf(doom.resolveSlide(grown.doom, from, measure))
  const target = geometryOf(doom.resolveSlide(grown.doom, to, measure))
  return { view: grown.doom, ids: grown.ids, from, to, geometry, target }
}

function painted(view: doom.Doom, slide: doom.NodeId, id: doom.NodeId) {
  return geometryOf(doom.resolveSlide(view, slide, doom.measureWith({}))).byId.get(id)?.bounds
}

describe("carrying layers across Grid slides", () => {
  it("finds the slide under a point given in the live slide's units, and where its corner sits", () => {
    const layout = gridLayout([["s:1", "s:2"].map(doom.nodeId), ["s:3"].map(doom.nodeId)], {
      width: 1920,
      height: 1080,
    })
    const [one, two, three] = layout.cards
    const home = one!.id
    expect(carryOver(layout.cards, home, { x: 500, y: 500 }, new Map())).toEqual({ kind: "home" })
    expect(carryOver(layout.cards, home, { x: two!.left - one!.left + 10, y: 10 }, new Map())).toEqual({
      kind: "slide",
      slide: two!.id,
      offset: { x: two!.left - one!.left, y: 0 },
      geometry: null,
    })
    expect(
      carryOver(layout.cards, home, { x: three!.left - one!.left + 5, y: three!.top - one!.top + 5 }, new Map()),
    ).toMatchObject({ kind: "slide", slide: three!.id })
    expect(carryOver(layout.cards, home, { x: 1920 + 4, y: 500 }, new Map())).toEqual({ kind: "none" })
    expect(carryOver(layout.cards, doom.nodeId("s:9"), { x: 5, y: 5 }, new Map())).toEqual({ kind: "none" })
  })

  it("lifts the layers and the connector both of their ends hold, and refuses a locked layer", () => {
    const { view, ids, from, geometry } = twoSlides()
    const lift = liftOf(view, geometry, [ids.a!, ids.b!], from, null)
    expect(lift?.carried).toEqual(new Set([ids.a, ids.b, ids.joint]))
    expect(lift?.from).toMatchObject({ left: 100, top: 100, right: 800, bottom: 220 })
    expect(liftOf(view, geometry, [ids.a!, ids.held!], from, null)).toBeNull()
    expect(liftOf(view, geometry, [ids.a!], from, null)?.carried).toEqual(new Set([ids.a]))
  })

  it("drops the grabbed point under the pointer on the other slide, in one edit that keeps ids", () => {
    const { view, ids, from, to, geometry } = twoSlides()
    const lift = liftOf(view, geometry, [ids.a!, ids.b!], from, null)!
    const offset = { x: 2040, y: 0 }
    const drop = carriedTo({ from: lift.from, by: { x: 2100.4, y: 50.6 }, offset, targets: null, reach: 0 })
    expect(drop.at).toEqual({ x: 160, y: 151 })
    expect(drop.by).toEqual({ x: 2100, y: 51 })
    const writes = dropWrites(view, lift, to, drop.at)!
    const after = landed(view, writes)
    expect(doom.parentOf(after.nodes.get(ids.a!))?.id).toBe(to)
    expect(doom.parentOf(after.nodes.get(ids.joint!))?.id).toBe(to)
    expect(painted(after, to, ids.a!)).toMatchObject({ left: 160, top: 151 })
    expect(painted(after, to, ids.b!)).toMatchObject({ left: 660, top: 151 })
  })

  it("keeps a turned group's child where it was painted when it leaves for another slide", () => {
    const { view, ids, from, to, geometry } = twoSlides()
    const was = geometry.byId.get(ids.inner!)!.bounds
    const lift = liftOf(view, geometry, [ids.inner!], from, null)!
    const drop = carriedTo({ from: lift.from, by: { x: 10, y: 20 }, offset: { x: 0, y: 0 }, targets: null, reach: 0 })
    const after = landed(view, dropWrites(view, lift, to, drop.at)!)
    const now = painted(after, to, ids.inner!)!
    expect(now.left).toBeCloseTo(was.left + 10, 0)
    expect(now.top).toBeCloseTo(was.top + 20, 0)
    expect(now.right - now.left).toBeCloseTo(was.right - was.left, 0)
  })

  it("snaps to the target slide's layers, and Alt copies land there while the originals stay", () => {
    const { view, ids, from, to, geometry, target } = twoSlides()
    const lift = liftOf(view, geometry, [ids.a!], from, null)!
    const near = carriedTo({
      from: lift.from,
      by: { x: 903, y: 302 },
      offset: { x: 0, y: 0 },
      targets: slideTargets(target, size),
      reach: 6,
    })
    expect(near.at).toEqual({ x: 1000, y: 400 })
    expect(near.guides.length).toBeGreaterThan(0)
    const copies = doom.duplicateWrites(
      view,
      [ids.a!],
      (() => {
        let made = 0
        return () => doom.nodeId(`c:${String((made += 1))}`)
      })(),
    )
    const copied = liftOf(view, geometry, [ids.a!], from, copies)!
    const after = landed(view, dropWrites(view, copied, to, { x: 40, y: 40 })!)
    const [copy] = copies.roots
    expect(doom.parentOf(after.nodes.get(ids.a!))?.id).toBe(from)
    expect(doom.parentOf(after.nodes.get(copy!))?.id).toBe(to)
    expect(painted(after, to, copy!)).toMatchObject({ left: 40, top: 40 })
  })

  it("writes nothing when the target slide or a carried layer is gone", () => {
    const { view, ids, from, to, geometry } = twoSlides()
    const lift = liftOf(view, geometry, [ids.a!, ids.b!], from, null)!
    expect(dropWrites(landed(view, [{ node: to, prop: "parent", value: null }]), lift, to, { x: 0, y: 0 })).toBeNull()
    expect(
      dropWrites(landed(view, [{ node: ids.b!, prop: "parent", value: null }]), lift, to, { x: 0, y: 0 }),
    ).toBeNull()
  })
})
