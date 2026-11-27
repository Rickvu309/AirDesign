import { describe, expect, it } from "vitest"
import { compileIntent } from "./intent-compile.js"
import { readIntent } from "./intent-read.js"
import { propOf } from "./doom-walk.js"
import {
  applyEdit,
  doomFromTree,
  isRefusal,
  measureWith,
  nodeId,
  resolveSlide,
  rev,
  type Intent,
  type Doom,
  type TreeNode,
} from "./index.js"
import { started } from "./testing/agent-fixtures.js"
import { agent, once } from "./sample-deck.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"
import { testTheme } from "./testing/theme.js"

const spot = (x: number, y: number, w: number, h: number) => ({
  x,
  y,
  w,
  h,
  rotation: 0,
  flipH: false,
  flipV: false,
})
const fill = (name: "accent1" | "accent2" | "accent3") => [{ kind: "solid" as const, color: { var: name } }]

function group(children: readonly TreeNode[]) {
  return doomFromTree({
    theme: testTheme,
    slides: [
      {
        children: [
          {
            type: "frame",
            name: "group",
            props: { box: spot(0, 0, 400, 300) },
            children,
          },
        ],
      },
    ],
  })
}

const layers: TreeNode[] = [
  { type: "shape" as const, name: "back", props: { box: spot(10, 10, 80, 60), fills: fill("accent1") } },
  {
    type: "shape" as const,
    name: "hole",
    props: { box: spot(40, 30, 200, 120), radius: 24, fills: fill("accent2"), mask: true },
  },
  { type: "shape" as const, name: "front", props: { box: spot(20, 20, 300, 200), fills: fill("accent3") } },
]

function open(doom: Doom): Doom {
  for (const run of doom.runs.values()) if (run.phase === "running") return doom
  return started(doom, "mask")
}

function landed(doom: Doom, change: Intent): Doom {
  const ready = open(doom)
  let next = 0
  const writes = compileIntent(ready, change, () => nodeId(`m:${String((next += 1))}`), placement, starts)
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const applied = applyEdit(ready, { once: once(), author: agent("mask"), writes, rev: rev(ready.rev + 1) })
  if (isRefusal(applied)) throw new Error(JSON.stringify(applied))
  return applied
}

describe("a mask is a layer that clips every sibling above it", () => {
  it("keeps the flag on the bottom layer and the layers above it, in that order", () => {
    const grown = group(layers)
    const [frame] = resolveSlide(grown.doom, grown.slides[0]!, measureWith({}))
    expect(frame?.children.map((child) => child.id)).toEqual([grown.ids.back, grown.ids.hole, grown.ids.front])
    expect(frame?.children.map((child) => child.mask)).toEqual([false, true, false])
  })

  it("drops a hidden mask, so the layers above it show whole", () => {
    const grown = group([layers[0]!, { ...layers[1]!, props: { ...layers[1]!.props, hidden: true } }, layers[2]!])
    const [frame] = resolveSlide(grown.doom, grown.slides[0]!, measureWith({}))
    expect(frame?.children.map((child) => child.id)).toEqual([grown.ids.back, grown.ids.front])
  })

  it("writes the same flag an agent sets, reads it back, and names a bad value", () => {
    const plain = group([
      layers[0]!,
      { ...layers[1]!, props: { box: spot(40, 30, 200, 120), fills: fill("accent2") } },
      layers[2]!,
    ])
    const hole = plain.ids.hole!
    const set = readIntent({ op: "update", target: hole, mask: true })
    expect(set).toMatchObject({ op: "update", mask: true })
    if (isRefusal(set)) return
    const masked = landed(plain.doom, set)
    expect(propOf(masked.nodes.get(hole)!, "mask")).toBe(true)
    const cleared = landed(masked, { op: "update", target: hole, mask: false })
    expect(propOf(cleared.nodes.get(hole)!, "mask")).toBe(false)
    expect(readIntent({ op: "update", target: hole, mask: "yes" })).toMatchObject({
      refused: "shape",
      field: "mask",
    })
    expect(readIntent({ op: "update", target: plain.slides[0], mask: true })).toMatchObject({ op: "update" })
    const slide = compileIntent(
      plain.doom,
      { op: "update", target: plain.slides[0]!, mask: true },
      () => nodeId("m:9"),
      placement,
      starts,
    )
    expect(slide).toMatchObject({ refused: "shape", field: "mask" })
  })
})
