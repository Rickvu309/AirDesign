import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"

export const spot = (x, y, w, h, rotation = 0) => ({ x, y, w, h, rotation, flipH: false, flipV: false })

export const words = (chars, more = {}) => ({
  chars,
  spans: [],
  paras: [{}],
  style: "body",
  resize: "fixed",
  alignV: "top",
  ...more,
})

export const accent = [{ kind: "solid", color: { var: "accent1" } }]
export const picture = (asset = "e".repeat(64)) => [{ kind: "image", asset, fit: "fill" }]

export const node = (page, id) => page.locator(`[data-slide-box] [data-node="${id}"]`)
export const selected = (page) => page.locator("[data-selection-outline]")

let counter = 0

async function orderKeys(kit) {
  const { orderKeyBetween } = await import(pathToFileURL(`${kit.repo}/packages/document/dist/index.js`).href)
  return orderKeyBetween
}

export async function readDoom(kit, opened) {
  return (await kit.post(kit.doomRoutes.open, { deck: opened.deck }, opened.cookie)).json
}

export async function savedNode(kit, opened, id) {
  return (await readDoom(kit, opened)).fold.nodes[id]
}

export async function landNodes(kit, opened, nodes) {
  if (nodes.length === 0) return
  counter += 1
  const orderKeyBetween = await orderKeys(kit)
  const last = new Map()
  const writes = nodes.flatMap((made) => {
    const parent = made.parent ?? opened.slide
    const at = orderKeyBetween(last.get(parent) ?? null, null)
    last.set(parent, at)
    return [
      { node: made.id, prop: "type", value: made.type ?? "shape" },
      { node: made.id, prop: "parent", value: { id: parent, at } },
      ...Object.entries(made.props ?? {}).map(([prop, value]) => ({ node: made.id, prop, value })),
    ]
  })
  const edit = {
    once: `look-${String(Date.now())}-${String(counter)}`,
    author: { kind: "person", id: "other-tab" },
    writes,
  }
  const landed = await kit.post(kit.doomRoutes.edit, { deck: opened.deck, edit }, opened.cookie)
  if (landed.json.ok !== true) throw new Error(`seeding the Doom deck was refused: ${JSON.stringify(landed.json)}`)
  for (const made of nodes) await expect(node(opened.page, made.id)).toBeAttached()
}

export async function openDoomDeck(kit, nodes = []) {
  const { page } = kit
  const { cookie } = await kit.signIn()
  await page.goto("/s")
  await page.locator("[data-doom-ready]").waitFor()
  const deck = new URL(page.url()).pathname.slice("/s/".length)
  const fold = (await kit.post(kit.doomRoutes.open, { deck }, cookie)).json.fold
  const slide = Object.values(fold.nodes).find((each) => each.type === "slide").id
  const opened = { page, deck, cookie, slide }
  await landNodes(kit, opened, nodes)
  return opened
}

export async function slidePoint(page, x, y) {
  const box = await page.locator("[data-slide-box]").boundingBox()
  if (box === null) throw new Error("no slide painted")
  const scale = box.width / 1920
  return { x: box.x + x * scale, y: box.y + y * scale }
}

export async function clickSlide(page, x, y, options = {}) {
  const at = await slidePoint(page, x, y)
  if (options.double === true) await page.mouse.dblclick(at.x, at.y)
  else await page.mouse.click(at.x, at.y, options.modifiers === undefined ? {} : { modifiers: options.modifiers })
}

export async function dragSlide(page, from, to, options = {}) {
  const start = await slidePoint(page, from.x, from.y)
  const end = await slidePoint(page, to.x, to.y)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: options.steps ?? 8 })
  if (options.hold !== true) await page.mouse.up()
}

export async function selectNode(page, id, options = {}) {
  const target = node(page, id)
  const box = await target.boundingBox()
  if (box === null) throw new Error(`node ${id} is not painted`)
  const position = options.position ?? { x: box.width / 2, y: box.height / 2 }
  await page.mouse.click(box.x + position.x, box.y + position.y, options.shift ? { modifiers: ["Shift"] } : {})
  await expect(page.locator(`[data-selection-outline="${id}"]`)).toBeAttached()
}

export async function openDesign(page) {
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await expect(page.locator("[data-design-panel]")).toBeVisible()
}
