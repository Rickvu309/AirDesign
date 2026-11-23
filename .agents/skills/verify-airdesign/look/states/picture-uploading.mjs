import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  const { page, post, doomRoutes } = kit
  const { cookie } = await kit.signIn()
  await page.goto("/s")
  await page.locator("[data-doom-ready]").waitFor()
  const deck = new URL(page.url()).pathname.slice("/s/".length)
  const { orderKeyBetween } = await import(pathToFileURL(`${kit.repo}/packages/doom/dist/index.js`).href)
  const opened = await post(doomRoutes.open, { deck }, cookie)
  const slide = Object.values(opened.json.fold.nodes).find((node) => node.type === "slide").id
  const box = { x: 360, y: 240, w: 1200, h: 600, rotation: 0, flipH: false, flipV: false }
  const writes = [
    { node: "w:1", prop: "type", value: "shape" },
    { node: "w:1", prop: "parent", value: { id: slide, at: orderKeyBetween(null, null) } },
    { node: "w:1", prop: "box", value: box },
    { node: "w:1", prop: "geometry", value: { kind: "rect" } },
    { node: "w:1", prop: "fills", value: [{ kind: "image", asset: "e".repeat(64), fit: "fill" }] },
  ]
  const edit = { once: "uploading-picture", author: { kind: "person", id: "other-device" }, writes }
  const landed = await post(doomRoutes.edit, { deck, edit }, cookie)
  expect(landed.json.ok).toBe(true)
  await page.locator('[data-slide-box] [data-node="w:1"]').waitFor()
}

export default { name: "picture-uploading", design: editor, drive }
