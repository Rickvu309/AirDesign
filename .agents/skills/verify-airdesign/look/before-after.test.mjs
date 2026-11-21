import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
import { PNG } from "pngjs"
import { blank } from "./images.mjs"
import { calloutCrops, composeBlock, driverFor, fullNames } from "./before-after.mjs"

it("names each block's full screenshots apart when blocks share a state", () => {
  expect(fullNames([{ state: "design-autofit" }, { state: "agent-empty" }, { state: "design-autofit" }])).toEqual([
    "design-autofit",
    "agent-empty",
    "design-autofit-2",
  ])
})

it("keeps both layouts in a shared crop when the new sidebar shrinks", () => {
  const sides = [{ key: "before" }, { key: "after" }]
  const shots = [248, 240].map((width) => ({
    full: PNG.sync.write(blank(500, 400)),
    viewport: { width: 500, height: 400 },
    frame: { x: 0, y: 0, width, height: 400 },
    boxes: [{ x: width - 8, y: 20, width: 8, height: 28 }],
  }))
  const { block } = composeBlock({ state: "decks-list", title: "Sidebar", crop: "aside", callouts: [] }, sides, shots)
  expect(block.width).toBe(248)
  expect(block.sides.map((side) => side.png.width)).toEqual([248, 248])
  expect(block.sides[0].boxes[0]).toEqual({ x: 240, y: 20, width: 8, height: 28 })
})

it("warns when a real target is cropped out instead of calling it absent", () => {
  const { warnings } = composeBlock(
    { state: "decks-list", title: "Sidebar", crop: "aside", callouts: [{ at: "button", note: "Border removed" }] },
    [{ key: "after" }],
    [
      {
        full: PNG.sync.write(blank(500, 400)),
        viewport: { width: 500, height: 400 },
        frame: { x: 0, y: 0, width: 240, height: 400 },
        boxes: [{ x: 300, y: 20, width: 100, height: 28 }],
      },
    ],
  )
  expect(warnings).toContain('decks-list: callout 1 "button" is outside the crop on after; widen the crop')
})

it("preserves moved frames and reports a partly clipped target", () => {
  const shots = [20, 60].map((x) => ({
    full: PNG.sync.write(blank(500, 400)),
    viewport: { width: 500, height: 400 },
    frame: { x, y: 20, width: 100, height: 80 },
    boxes: [{ x: 10, y: 30, width: 30, height: 20 }],
  }))
  const { block, warnings } = composeBlock(
    { state: "decks-list", title: "Moved control", crop: "header", callouts: [{ at: "button", note: "Moved" }] },
    [{ key: "before" }, { key: "after" }],
    shots,
  )
  expect(block.width).toBe(140)
  expect(block.height).toBe(80)
  expect(block.sides[0].boxes[0]).toEqual({ x: 0, y: 10, width: 20, height: 20 })
  expect(warnings).toHaveLength(2)
  expect(warnings[0]).toContain("clipped by the crop on before")
})

const shotOf = () => ({
  full: PNG.sync.write(blank(500, 400)),
  viewport: { width: 500, height: 400 },
  frame: null,
  boxes: [],
})
const pair = [
  { key: "before", name: "main" },
  { key: "after", name: "this PR" },
]
const block = { state: "agent-empty", title: "Agent panel", crop: null, callouts: [] }

it("badges a base that failed to capture as failed, not new", () => {
  const { block: drawn } = composeBlock(block, pair, [{ error: "Timeout 20000ms", outcome: "failed" }, shotOf()])
  expect(drawn.badge).toEqual({ text: "Failed on main", outcome: "failed" })
})

it("badges a state main does not have as new", () => {
  const { block: drawn } = composeBlock(block, pair, [{ error: "no such button", outcome: "new" }, shotOf()])
  expect(drawn.badge).toEqual({ text: "New in this PR", outcome: "new" })
})

it("knows a state is new only when the base's own state list lacks it", async () => {
  const repo = mkdtempSync(path.join(tmpdir(), "base-states-"))
  const look = path.join(repo, ".agents/skills/verify-airdesign/look")
  mkdirSync(look, { recursive: true })
  writeFileSync(
    path.join(look, "states.mjs"),
    'export const states = [{ name: "agent-empty" }]\nexport const find = (name) => ({ name })\nexport const reach = async () => {}\n',
  )
  const driver = await driverFor(repo)
  expect(driver.lacks("agent-empty")).toBe(false)
  expect(driver.lacks("agent-new")).toBe(true)
})

it("never calls a state new when the base has no state list to check", async () => {
  const repo = mkdtempSync(path.join(tmpdir(), "base-bare-"))
  const driver = await driverFor(repo)
  expect(driver.lacks("agent-new")).toBe(false)
})

it("cuts a strip of the frame at each callout's height on each side it was found, whole lines with room above and below", () => {
  const shot = (boxes) => ({ full: PNG.sync.write(blank(500, 400)), viewport: { width: 250, height: 200 }, boxes })
  const crops = calloutCrops(
    {
      state: "agent-empty",
      callouts: [
        { at: "h2", note: "Names Aira" },
        { at: "p", note: "Gone" },
      ],
    },
    pair,
    [shot([{ x: 100, y: 50, width: 40, height: 10 }, null]), shot([{ x: 230, y: 190, width: 40, height: 10 }, null])],
  )
  expect(crops.map(({ number, side, png }) => [number, side, png.width, png.height])).toEqual([
    [1, "before", 500, 148],
    [1, "after", 500, 84],
  ])
})

it("cuts nothing on a side that was not reached", () => {
  const crops = calloutCrops({ state: "agent-empty", callouts: [{ at: "h2", note: "Names Aira" }] }, pair, [
    { error: "Timeout", outcome: "failed" },
    {
      full: PNG.sync.write(blank(250, 200)),
      viewport: { width: 250, height: 200 },
      boxes: [{ x: 10, y: 10, width: 20, height: 10 }],
    },
  ])
  expect(crops.map(({ side }) => side)).toEqual(["after"])
})
