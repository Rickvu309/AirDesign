import { expect } from "@playwright/test"
import { accent, node, openDoomDeck, selectNode, spot } from "./doom-deck.mjs"

export const solid = (name) => [{ kind: "solid", color: { var: name } }]

const pad = (by) => ({ t: by, r: by, b: by, l: by })

export const twoShapes = [
  { id: "w:1", props: { name: "Rectangle", box: spot(900, 160, 420, 260), geometry: { kind: "rect" }, fills: accent } },
  {
    id: "w:2",
    props: { name: "Ellipse", box: spot(1420, 560, 300, 300), geometry: { kind: "ellipse" }, fills: solid("accent2") },
  },
]

export const nestedGroups = [
  {
    id: "g:1",
    type: "frame",
    props: { name: "Scaled", box: spot(900, 440, 820, 480), sizing: { w: "hug", h: "hug" } },
  },
  {
    id: "g:2",
    type: "frame",
    parent: "g:1",
    props: { name: "Turned", box: spot(20, 120, 480, 220, 30), sizing: { w: "hug", h: "hug" } },
  },
  {
    id: "w:4",
    parent: "g:2",
    props: { name: "Leaf", box: spot(0, 0, 220, 220), geometry: { kind: "rect" }, fills: accent },
  },
  {
    id: "w:5",
    parent: "g:2",
    props: { name: "Twin", box: spot(260, 0, 220, 220), geometry: { kind: "ellipse" }, fills: solid("accent2") },
  },
  {
    id: "w:6",
    parent: "g:1",
    props: {
      name: "Beside",
      box: spot(620, 0, 200, 200),
      geometry: { kind: "rect" },
      radius: 32,
      fills: solid("accent3"),
    },
  },
  {
    id: "w:7",
    props: { name: "Loose", box: spot(1360, 120, 360, 220), geometry: { kind: "rect" }, fills: solid("accent4") },
  },
]

export const autoRow = (childSizing = { w: "fixed", h: "fixed" }) => [
  {
    id: "f:1",
    type: "frame",
    props: {
      name: "Row",
      box: spot(900, 300, 728, 280),
      fills: solid("background2"),
      radius: 16,
      sizing: { w: "hug", h: "hug" },
      layout: { mode: "row", gap: 24, padding: pad(40), align: "center-left" },
    },
  },
  {
    id: "w:1",
    parent: "f:1",
    props: {
      name: "Square",
      box: spot(40, 40, 200, 200),
      geometry: { kind: "rect" },
      fills: accent,
      sizing: childSizing,
    },
  },
  {
    id: "w:2",
    parent: "f:1",
    props: { name: "Circle", box: spot(264, 40, 200, 200), geometry: { kind: "ellipse" }, fills: solid("accent2") },
  },
  {
    id: "w:3",
    parent: "f:1",
    props: {
      name: "Triangle",
      box: spot(488, 40, 200, 200),
      geometry: { kind: "preset", name: "triangle" },
      fills: solid("accent3"),
    },
  },
]

export const nestedFrames = [
  {
    id: "f:1",
    type: "frame",
    props: {
      name: "Column",
      box: spot(900, 200, 560, 560),
      fills: solid("background2"),
      radius: 16,
      sizing: { w: "hug", h: "hug" },
      layout: { mode: "column", gap: 24, padding: pad(32), align: "top-center" },
    },
  },
  {
    id: "f:2",
    type: "frame",
    parent: "f:1",
    props: {
      name: "Row",
      box: spot(32, 32, 496, 248),
      fills: solid("background"),
      radius: 12,
      sizing: { w: "hug", h: "hug" },
      layout: { mode: "row", gap: 24, padding: pad(24), align: "center-left" },
    },
  },
  {
    id: "w:1",
    parent: "f:2",
    props: { name: "Square", box: spot(24, 24, 200, 200), geometry: { kind: "rect" }, fills: accent },
  },
  {
    id: "w:2",
    parent: "f:2",
    props: { name: "Circle", box: spot(248, 24, 200, 200), geometry: { kind: "ellipse" }, fills: solid("accent2") },
  },
  {
    id: "w:3",
    parent: "f:1",
    props: {
      name: "Triangle",
      box: spot(180, 304, 200, 200),
      geometry: { kind: "preset", name: "triangle" },
      fills: solid("accent3"),
    },
  },
]

export const connected = (route = "elbow") => [
  { id: "w:1", props: { name: "Start", box: spot(860, 180, 320, 200), geometry: { kind: "rect" }, fills: accent } },
  {
    id: "w:2",
    props: { name: "End", box: spot(1440, 660, 320, 200), geometry: { kind: "rect" }, fills: solid("accent2") },
  },
  {
    id: "w:3",
    props: {
      name: "Connector",
      box: spot(1180, 280, 420, 380),
      geometry: {
        kind: "line",
        start: { node: "w:1", site: "r" },
        end: { node: "w:2", site: "t" },
        route,
        arrows: ["none", "arrow"],
      },
      strokes: solid("text"),
      stroke: { weight: 3, align: "center", dash: "solid" },
    },
  },
]

export function cards(rows = 3, columns = 4) {
  return Array.from({ length: rows * columns }, (_, at) => {
    const row = Math.floor(at / columns)
    const column = at % columns
    return {
      id: `c:${String(at + 1)}`,
      props: {
        name: `Card ${String(at + 1)}`,
        box: spot(860 + column * 250, 140 + row * 270, 220, 230),
        geometry: { kind: "rect" },
        radius: 16,
        fills: solid(row === 1 ? "accent1" : "background2"),
      },
    }
  })
}

export async function centre(page, id) {
  const box = await node(page, id).boundingBox()
  if (box === null) throw new Error(`node ${id} is not painted`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export async function grip(page, name) {
  const box = await page.locator(`[data-slide-box] [data-handles] [data-grip="${name}"]`).boundingBox()
  if (box === null) throw new Error(`no ${name} grip`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export async function hold(page, from, to, steps = 10) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps })
}

export async function drag(page, from, to, steps = 10) {
  await hold(page, from, to, steps)
  await page.mouse.up()
}

export async function selectedIds(page) {
  return page
    .locator("[data-selection-outline]")
    .evaluateAll((all) => all.map((each) => each.getAttribute("data-selection-outline")))
}

export async function selectMany(page, ids) {
  const [first, ...rest] = ids
  await selectNode(page, first)
  for (const id of rest) await selectNode(page, id, { shift: true })
  await expect(page.locator("[data-selection-outline]")).toHaveCount(ids.length)
}

export async function deepPick(page, id) {
  const at = await centre(page, id)
  await page.keyboard.down("Control")
  await page.mouse.click(at.x, at.y)
  await page.keyboard.up("Control")
  await expect(page.locator(`[data-selection-outline="${id}"]`)).toBeAttached()
}

export async function nested(kit) {
  return openDoomDeck(kit, nestedGroups)
}

export async function pickShape(page, name) {
  await page.getByRole("button", { name: "Shapes", exact: true }).click()
  await page.getByRole("button", { name, exact: true }).click()
}
