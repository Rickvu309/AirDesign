import { expect, type BrowserContext, type Page } from "@playwright/test"
import type { ReadDeckAnswer } from "../../packages/engine/src/index.ts"
import { forward, signInBrowser, type Stack } from "./api-stack"
import { entry, manySlides, openGrid } from "./slide-grid-deck"
import { decksOn } from "./deck-test"

export type Saved = {
  readonly deck: string
  readonly cookie: string
  readonly ids: readonly string[]
  readonly order: () => Promise<string[]>
  readonly rows: () => Promise<string[][]>
}

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export async function openSaved(
  page: Page,
  context: BrowserContext,
  stack: Stack,
  file: number | string,
  sections: boolean | readonly number[] = false,
  view: "grid" | "list" = "grid",
): Promise<Saved> {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await decksOn(page).open(
    typeof file === "string"
      ? file
      : { name: "slides.pptx", mimeType: "application/octet-stream", buffer: await manySlides(file, sections) },
  )
  const deck = new URL(page.url()).pathname.slice("/deck/".length)
  const order = async () => {
    const read = (await stack.callTool("airdesign_read_deck", { deck }, cookie)) as ReadDeckAnswer
    return read.slides.map((slide) => slide.id)
  }
  const rows = async () => {
    const read = (await stack.callTool("airdesign_read_deck", { deck }, cookie)) as ReadDeckAnswer
    const partition: string[][] = []
    const firsts = new Set(read.groups.map((group) => group.first))
    for (const slide of read.slides) {
      if (firsts.has(slide.id) || partition.length === 0) partition.push([slide.id])
      else partition.at(-1)?.push(slide.id)
    }
    return partition
  }
  const count = await page.locator("[data-slide-entry]").count()
  await expect.poll(async () => (await order()).length, { timeout: 15_000 }).toBe(count)
  if (view === "list") return { deck, cookie, ids: await order(), order, rows }
  await openGrid(page)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !document.documentElement.matches(":active-view-transition") &&
          document.getAnimations().every((animation) => animation.playState !== "running"),
      ),
    )
    .toBe(true)
  return { deck, cookie, ids: await order(), order, rows }
}

export function picked(ids: readonly string[], numbers: readonly number[]): string[] {
  return numbers.map((number) => ids[number - 1] ?? "missing")
}

export async function zoomTo(page: Page, percent: number): Promise<void> {
  await page.locator("[data-zoom-readout]").click()
  await page.locator("[data-zoom-field]").fill(String(percent))
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-zoom-readout]")).toHaveText(new RegExp(`^${String(percent)}`))
  await expect(page.locator("[data-zoom-field]")).toHaveCount(0)
}

export function canvas(page: Page) {
  return page.locator("[data-grid-viewport]")
}

export async function boxOf(page: Page, number: number): Promise<Box> {
  const box = await entry(page, number).boundingBox()
  if (box === null) throw new Error(`no slide ${String(number)}`)
  return box
}

export async function roomOf(page: Page): Promise<Box> {
  const box = await canvas(page).boundingBox()
  if (box === null) throw new Error("no canvas")
  return box
}

export async function panOf(page: Page): Promise<{ readonly x: number; readonly y: number }> {
  return page.locator('[role="group"][aria-label="Slides"]').evaluate((world) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(world).transform)
    return { x: matrix.m41, y: matrix.m42 }
  })
}

export async function visibleCenter(page: Page, number: number): Promise<{ readonly x: number; readonly y: number }> {
  const box = await boxOf(page, number)
  const room = await roomOf(page)
  const left = Math.max(box.x, room.x + 80)
  const right = Math.min(box.x + box.width, room.x + room.width - 80)
  const top = Math.max(box.y, room.y + 80)
  const bottom = Math.min(box.y + box.height, room.y + room.height - 80)
  if (left >= right || top >= bottom) throw new Error(`slide ${String(number)} is not in view`)
  return { x: (left + right) / 2, y: (top + bottom) / 2 }
}

export async function grab(page: Page, number: number): Promise<void> {
  const point = await visibleCenter(page, number)
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(point.x + 12, point.y + 12, { steps: 3 })
}

export async function hover(page: Page, number: number, across: number): Promise<void> {
  const box = await boxOf(page, number)
  const room = await roomOf(page)
  const x = Math.min(Math.max(box.x + box.width * across, room.x + 80), room.x + room.width - 80)
  const y = Math.min(Math.max(box.y + box.height / 2, room.y + 80), room.y + room.height - 80)
  await page.mouse.move(x, y, { steps: 6 })
}

export function moveRequests(page: Page): () => number {
  let moves = 0
  page.on("request", (request) => {
    if (request.postData()?.match(/"slide":"move(?:-many)?"/)) moves += 1
  })
  return () => moves
}
