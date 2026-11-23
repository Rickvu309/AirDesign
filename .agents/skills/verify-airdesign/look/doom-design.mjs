import { readFile } from "node:fs/promises"
import path from "node:path"
import { expect } from "@playwright/test"
import {
  accent,
  node,
  openDesign,
  openDoomDeck,
  readDoom,
  selectNode,
  slidePoint,
  slowPaint,
  spot,
  words,
} from "./doom-deck.mjs"

export const element = "/screens/s43-09-editor-tools-design-element"
export const slidePanel = "/screens/s43-02-editor-tools-design-panel"

const ink = [{ kind: "solid", color: { var: "text" } }]

export const seeds = {
  text: {
    id: "w:1",
    props: { name: "Quarterly review", box: spot(140, 700, 900, 140), text: words("Quarterly review") },
  },
  note: { id: "w:6", props: { name: "Revenue note", box: spot(140, 860, 900, 100), text: words("Revenue grew 39%") } },
  shape: {
    id: "w:2",
    props: { name: "Card", box: spot(1100, 220, 520, 320), geometry: { kind: "rect" }, fills: accent },
  },
  ellipse: {
    id: "w:3",
    props: {
      name: "Dot",
      box: spot(1250, 640, 240, 240),
      geometry: { kind: "ellipse" },
      fills: [{ kind: "solid", color: { var: "accent2" } }],
    },
  },
  line: {
    id: "w:4",
    props: {
      name: "Rule",
      box: spot(1100, 960, 520, 0),
      geometry: {
        kind: "line",
        start: { x: 1100, y: 960 },
        end: { x: 1620, y: 960 },
        route: "straight",
        arrows: ["none", "arrow"],
      },
      strokes: ink,
      stroke: { weight: 4, align: "center", dash: "solid" },
    },
  },
  frame: [
    {
      id: "w:7",
      type: "frame",
      props: {
        name: "Row",
        box: spot(1000, 260, 760, 300),
        fills: [{ kind: "solid", color: { var: "background2" } }],
        layout: { mode: "row", gap: 24, padding: { t: 32, r: 32, b: 32, l: 32 }, align: "top-left" },
      },
    },
    {
      id: "w:8",
      parent: "w:7",
      props: { name: "First", box: spot(0, 0, 220, 220), geometry: { kind: "rect" }, fills: accent },
    },
    {
      id: "w:9",
      parent: "w:7",
      props: {
        name: "Second",
        box: spot(0, 0, 220, 220),
        geometry: { kind: "ellipse" },
        fills: [{ kind: "solid", color: { var: "accent2" } }],
      },
    },
  ],
  icon: {
    id: "w:5",
    props: {
      name: "Icon",
      box: spot(1680, 260, 160, 160),
      geometry: { kind: "icon", name: "lucide/rocket" },
      strokes: ink,
      stroke: { weight: 13, align: "center", dash: "solid" },
    },
  },
}

export async function designing(kit, ...kinds) {
  const opened = await openDoomDeck(
    kit,
    kinds.flatMap((kind) => seeds[kind]),
  )
  await kit.page.evaluate(() => document.fonts.ready.then(() => undefined))
  await openDesign(kit.page)
  return opened
}

export async function titleOf(kit, opened) {
  const nodes = Object.values((await readDoom(kit, opened)).fold.nodes)
  const title = nodes.find((each) => each.role === "title")
  if (title === undefined) throw new Error("the blank Doom slide has no title")
  return title.id
}

export async function selectTitle(kit, opened) {
  const id = await titleOf(kit, opened)
  await selectNode(kit.page, id, { position: { x: 8, y: 8 } })
  return id
}

export async function selectMany(page, ids) {
  for (const [at, id] of ids.entries()) await selectNode(page, id, at === 0 ? {} : { shift: true })
  await expect(page.locator("[data-selection-outline]")).toHaveCount(ids.length)
}

export async function dropPicture(kit, at = { x: 1300, y: 560 }) {
  const { page } = kit
  const bytes = [...(await readFile(path.join(kit.repo, "scripts/pptx-fixtures/picture.png")))]
  const point = await slidePoint(page, at.x, at.y)
  await page.evaluate(
    ([bytes, point]) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([new Uint8Array(bytes)], "picture.png", { type: "image/png" }))
      document.querySelector("[data-doom-stage]").dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
          clientX: point.x,
          clientY: point.y,
        }),
      )
    },
    [bytes, point],
  )
  const painted = page.locator("[data-slide-box] [data-node]").filter({ has: page.locator('[data-paint="image"]') })
  await expect(painted).toHaveCount(1, slowPaint)
  await expect
    .poll(() => painted.locator('[data-paint="image"]').evaluate((each) => getComputedStyle(each).backgroundImage))
    .toContain("url(")
  return painted.getAttribute("data-node")
}

export async function panelTop(page) {
  await page.mouse.move(4, 4)
  await page.locator("[data-design-panel]").evaluate((panel) => {
    panel.scrollTop = 0
  })
}

export { node }
