import type { BrowserContext, Page } from "@playwright/test"
import { orderKeyBetween, type OrderKey } from "../../packages/doom/src/index.ts"
import * as doom from "../../packages/doom/src/index.ts"
import { forward, signInBrowser, type Stack } from "./api-stack"

const catalog = () => import("../../packages/catalog/src/index.ts")

export type Opened = { readonly deck: string; readonly cookie: string; readonly slide: string }

export const spot = (x: number, y: number, w: number, h: number) => ({
  x,
  y,
  w,
  h,
  rotation: 0,
  flipH: false,
  flipV: false,
})

export const accent = [{ kind: "solid", color: { var: "accent1" } }]

export async function openDoomEditor(page: Page, context: BrowserContext, stack: Stack): Promise<Opened> {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/s")
  await page.locator("[data-doom-ready]").waitFor()
  const deck = new URL(page.url()).pathname.slice("/s/".length)
  const { doomRoutes } = await catalog()
  const opened = await stack.post(doomRoutes.open.path, { deck }, cookie)
  const fold = doom.readFold(opened.json.fold)
  const slide = [...(fold?.nodes.values() ?? [])].find((node) => node.type === "slide")
  if (slide === undefined) throw new Error("no slide")
  return { deck, cookie, slide: slide.id }
}

type Made = { readonly id: string; readonly type: "frame" | "shape"; readonly parent: string; readonly props?: object }

let counter = 0

export async function landNodes(stack: Stack, opened: Opened, nodes: readonly Made[]): Promise<void> {
  counter += 1
  const { doomRoutes } = await catalog()
  const last = new Map<string, OrderKey | null>([[opened.slide, orderKeyBetween(null, null)]])
  const writes = nodes.flatMap((node) => {
    const at = orderKeyBetween(last.get(node.parent) ?? null, null)
    last.set(node.parent, at)
    return [
      { node: node.id, prop: "type", value: node.type },
      { node: node.id, prop: "parent", value: { id: node.parent, at } },
      ...Object.entries(node.props ?? {}).map(([prop, value]) => ({ node: node.id, prop, value })),
    ]
  })
  const edit = { once: `test-${String(counter)}`, author: { kind: "person", id: "other-tab" }, writes }
  const landed = await stack.post(doomRoutes.edit.path, { deck: opened.deck, edit }, opened.cookie)
  if (landed.json.ok !== true) throw new Error(JSON.stringify(landed.json))
}

export async function clearSubtitle(stack: Stack, opened: Opened): Promise<void> {
  counter += 1
  const { doomRoutes } = await catalog()
  const edit = {
    once: `test-${String(counter)}`,
    author: { kind: "person", id: "other-tab" },
    writes: [{ node: "s:5", prop: "parent", value: null }],
  }
  const landed = await stack.post(doomRoutes.edit.path, { deck: opened.deck, edit }, opened.cookie)
  if (landed.json.ok !== true) throw new Error(JSON.stringify(landed.json))
}

export async function slidePoint(
  page: Page,
  x: number,
  y: number,
): Promise<{ readonly x: number; readonly y: number }> {
  const box = await page.locator("[data-slide-box]").boundingBox()
  if (box === null) throw new Error("no slide")
  const scale = box.width / 1920
  return { x: box.x + x * scale, y: box.y + y * scale }
}

export async function dragSlide(
  page: Page,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Promise<void> {
  const start = await slidePoint(page, from.x, from.y)
  const end = await slidePoint(page, to.x, to.y)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()
}

export async function clickSlide(page: Page, x: number, y: number, options: { readonly double?: boolean } = {}) {
  const at = await slidePoint(page, x, y)
  if (options.double === true) await page.mouse.dblclick(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
}

export async function savedNode(
  stack: Stack,
  opened: Opened,
  id: string,
): Promise<Record<string, unknown> | undefined> {
  const { doomRoutes } = await catalog()
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const fold = doom.readFold(answer.json.fold)
  return fold?.nodes.get(doom.nodeId(id)) as Record<string, unknown> | undefined
}

export const selectedIds = (page: Page) =>
  page
    .locator("[data-selection-outline]")
    .evaluateAll((all) => all.map((each) => each.getAttribute("data-selection-outline")))

export async function savedSlides(stack: Stack, opened: Opened): Promise<readonly string[]> {
  const { doomRoutes } = await catalog()
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const fold = doom.readFold(answer.json.fold)
  return fold === undefined ? [] : doom.slidesOf(fold).map((slide) => slide.id)
}

export async function serveOriginals(page: Page, originals: Stack["originals"]): Promise<void> {
  const allow = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "PUT, GET, OPTIONS",
    "access-control-allow-headers": "*",
  }
  await page.route(
    (url) => url.hostname === "original.test",
    async (route) => {
      const request = route.request()
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: allow })
        return
      }
      try {
        if (request.method() === "PUT") {
          const bytes = new Uint8Array(request.postDataBuffer() ?? Buffer.alloc(0))
          originals.put(request.url(), bytes, { ...request.headers(), "content-length": String(bytes.byteLength) })
          await route.fulfill({ status: 200, headers: allow, body: "" })
          return
        }
        await route.fulfill({
          status: 200,
          headers: allow,
          body: Buffer.from(originals.get(request.url())),
          contentType: "application/octet-stream",
        })
      } catch (error) {
        await route.fulfill({ status: request.method() === "PUT" ? 412 : 404, headers: allow, body: String(error) })
      }
    },
  )
}
