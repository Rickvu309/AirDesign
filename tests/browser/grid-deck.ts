import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test"
import * as doom from "../../packages/doom/src/index.ts"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy.ts"
import { zoomCopy } from "../../apps/web/src/copy/product-copy.ts"
import type { Stack } from "./api-stack"
import { openEditor, otherTab, type Opened } from "./editor-deck"

const catalog = () => import("../../packages/catalog/src/index.ts")

export type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export type Point = { readonly x: number; readonly y: number }
export type Grouped = Opened & { readonly ids: readonly string[] }

type Write = { readonly node: string; readonly prop: string; readonly value: unknown }

let seeded = 0

function groupWrites(fold: doom.Doom, sizes: readonly number[]): Write[] {
  const slides = doom.slidesOf(fold)
  const last = doom.parentOf(slides.at(-1))
  const first = last == null ? undefined : fold.nodes.get(last.id)
  const deck = doom.parentOf(first)
  if (last == null || first === undefined || deck == null) throw new Error("the start deck has no slide group")
  const writes: Write[] = []
  let groupAt: doom.OrderKey = deck.at
  let made = 0
  sizes.forEach((size, group) => {
    let parent: string = first.id
    let at: doom.OrderKey | null = group === 0 ? last.at : null
    if (group > 0) {
      groupAt = doom.orderKeyBetween(groupAt, null)
      parent = `seedgroup:${String(group)}`
      writes.push(
        { node: parent, prop: "type", value: "slideRow" },
        { node: parent, prop: "parent", value: { id: deck.id, at: groupAt } },
      )
    }
    for (let index = 0; index < (group === 0 ? size - slides.length : size); index += 1) {
      made += 1
      at = doom.orderKeyBetween(at, null)
      const id = `seedslide:${String(made)}`
      writes.push({ node: id, prop: "type", value: "slide" }, { node: id, prop: "parent", value: { id: parent, at } })
    }
  })
  return writes
}

async function savedIds(stack: Stack, opened: Opened): Promise<readonly string[]> {
  const { doomRoutes } = await catalog()
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const fold = doom.readFold(answer.json.fold)
  return fold === undefined ? [] : doom.slidesOf(fold).map((slide) => slide.id)
}

export async function openGroups(
  page: Page,
  context: BrowserContext,
  stack: Stack,
  sizes: readonly number[],
): Promise<Grouped> {
  const opened = await openEditor(page, context, stack)
  const { doomRoutes } = await catalog()
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const fold = doom.readFold(answer.json.fold)
  if (fold === undefined) throw new Error("no deck")
  seeded += 1
  const edit = {
    once: `grid-${String(seeded)}`,
    author: { kind: "person", id: "other-tab" },
    writes: groupWrites(fold, sizes),
  }
  const landed = await stack.post(doomRoutes.edit.path, { deck: opened.deck, edit }, opened.cookie)
  if (landed.json.ok !== true) throw new Error(JSON.stringify(landed.json))
  const total = sizes.reduce((sum, size) => sum + size, 0)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(total)
  await openGrid(page)
  await expect(entries(page)).toHaveCount(total)
  return { ...opened, ids: await savedIds(stack, opened) }
}

export async function otherGrid(context: BrowserContext, stack: Stack, opened: Grouped): Promise<Page> {
  const other = await otherTab(context, stack, opened.deck)
  if ((await viewport(other).count()) === 0) await openGrid(other)
  await expect(entries(other)).toHaveCount(opened.ids.length)
  return other
}

export async function openGrid(page: Page): Promise<void> {
  await page.getByRole("button", { name: slideListCopy.gridView }).click()
  await expect(viewport(page)).toBeVisible()
}

export const viewport = (page: Page) => page.locator("[data-grid-viewport]")
export const entries = (page: Page) => page.locator("[data-editor-grid] [data-slide-entry]")
export const entry = (page: Page, number: number) =>
  page.locator(`[data-editor-grid] [data-slide-entry="${String(number)}"]`)
export const card = (page: Page, number: number) =>
  page.locator("[data-grid-card]").filter({ has: page.locator(`[data-slide-entry="${String(number)}"]`) })
export const readout = (page: Page) => page.locator("[data-zoom-readout]")
export const chip = (page: Page) => page.locator("[data-grid-selected]")
export const said = (page: Page) => page.locator("[data-editor-grid] [data-announcer]")

export async function boxOf(target: Locator): Promise<Box> {
  const box = await target.boundingBox()
  if (box === null) throw new Error("no box")
  return box
}

export async function centre(page: Page, number: number): Promise<Point> {
  const box = await boxOf(entry(page, number))
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export function percent(page: Page): Promise<number> {
  return readout(page)
    .textContent()
    .then((text) => Number.parseInt(text ?? "", 10))
}

export function selectedNumbers(page: Page): Promise<number[]> {
  return page
    .locator("[data-editor-grid] [data-slide-entry][data-selected]")
    .evaluateAll((all) => all.map((each) => Number(each.getAttribute("data-slide-entry"))))
}

export async function zoomTo(page: Page, zoom: number | "fit"): Promise<void> {
  await readout(page).click()
  if (zoom === "fit") await page.getByRole("menuitemradio", { name: zoomCopy.fit, exact: true }).click()
  else {
    await page.getByRole("textbox", { name: zoomCopy.field }).fill(String(zoom))
    await page.getByRole("textbox", { name: zoomCopy.field }).press("Enter")
    await expect(readout(page)).toHaveText(new RegExp(`^${String(zoom)}%`))
  }
  await expect(page.getByRole("textbox", { name: zoomCopy.field })).toHaveCount(0)
}

export async function inside(target: Locator, room: Locator): Promise<boolean> {
  const [box, around] = [await boxOf(target), await boxOf(room)]
  return (
    box.x >= around.x - 0.5 &&
    box.y >= around.y - 0.5 &&
    box.x + box.width <= around.x + around.width + 0.5 &&
    box.y + box.height <= around.y + around.height + 0.5
  )
}

export async function wheelAt(
  page: Page,
  at: Point,
  delta: Point,
  keys: { ctrlKey?: boolean; shiftKey?: boolean } = {},
) {
  await viewport(page).dispatchEvent("wheel", {
    deltaX: delta.x,
    deltaY: delta.y,
    clientX: at.x,
    clientY: at.y,
    ...keys,
  })
}

export async function savedGroups(stack: Stack, opened: Opened): Promise<readonly (readonly string[])[]> {
  const { doomRoutes } = await catalog()
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const fold = doom.readFold(answer.json.fold)
  const groups = new Map<string, string[]>()
  for (const slide of fold === undefined ? [] : doom.slidesOf(fold)) {
    const group = doom.parentOf(slide)?.id ?? ""
    groups.set(group, [...(groups.get(group) ?? []), slide.id])
  }
  return [...groups.values()]
}

export function shownGroups(page: Page): Promise<number[][]> {
  return page.locator("[data-editor-grid] [data-slide-list]").evaluate((list) => {
    const groups: number[][] = []
    for (const child of list.children) {
      if (child.matches("[data-grid-group-frame]")) groups.push([])
      const number = child.querySelector("[data-slide-entry]")?.getAttribute("data-slide-entry")
      if (child.matches("[data-grid-card]") && number !== null && number !== undefined)
        groups.at(-1)?.push(Number(number))
    }
    return groups
  })
}

export const picked = (ids: readonly string[], numbers: readonly number[]) => numbers.map((number) => ids[number - 1]!)

export const grip = (page: Page, group: number) =>
  page.getByRole("button", { name: slideListCopy.moveGroup(group), exact: true })

const blankDown = 0.85

export async function grab(page: Page, number: number, across = 0.5): Promise<Box> {
  const box = await boxOf(entry(page, number))
  await page.mouse.move(box.x + box.width * across, box.y + box.height * blankDown)
  await page.mouse.down()
  return box
}

export async function hoverOver(page: Page, number: number, across: number): Promise<void> {
  const box = await boxOf(entry(page, number))
  await page.mouse.move(box.x + box.width * across, box.y + box.height / 2, { steps: 8 })
}

export async function reopenGrid(page: Page): Promise<void> {
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  if ((await viewport(page).count()) === 0) await openGrid(page)
}
