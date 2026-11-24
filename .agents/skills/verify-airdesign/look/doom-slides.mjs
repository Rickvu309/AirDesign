import { expect } from "@playwright/test"
import { readDoom } from "./doom-deck.mjs"

let counter = 0

export const entries = (page) => page.locator("[data-slide-entry]")
export const entry = (page, number) => page.locator(`[data-slide-entry="${String(number)}"]`)

export async function editNodes(kit, opened, writes) {
  counter += 1
  const edit = {
    once: `look-slides-${String(Date.now())}-${String(counter)}`,
    author: { kind: "person", id: "other-tab" },
    writes,
  }
  const landed = await kit.post(kit.doomRoutes.edit, { deck: opened.deck, edit }, opened.cookie)
  if (landed.json.ok !== true) throw new Error(`the Doom edit was refused: ${JSON.stringify(landed.json)}`)
}

export async function addSlides(page, count) {
  const before = await entries(page).count()
  for (let added = 1; added <= count; added += 1) {
    await page.getByRole("button", { name: "Add slide", exact: true }).click()
    await expect(entries(page)).toHaveCount(before + added)
  }
}

export async function addSlideStart(page, start) {
  const before = await entries(page).count()
  await page.getByRole("button", { name: "Choose a layout for the new slide", exact: true }).click()
  await page.getByRole("menuitem", { name: start, exact: true }).click()
  await expect(entries(page)).toHaveCount(before + 1)
  await expect(entry(page, before + 1)).toHaveAttribute("aria-current", "true")
}

async function slidesOf(kit, opened) {
  const read = await readDoom(kit, opened)
  const all = Object.values(read.fold.nodes).map((node) => ({ ...node, base: read.rev }))
  const order = (node) => node.parent?.at ?? ""
  const childrenOf = (id) => all.filter((node) => node.parent?.id === id).sort((a, b) => (order(a) < order(b) ? -1 : 1))
  const row = all.find((node) => node.type === "slideRow")
  return childrenOf(row.id).map((slide) => ({
    slide,
    title: childrenOf(slide.id).find((node) => node.role === "title"),
  }))
}

export async function slideIds(kit, opened) {
  return (await slidesOf(kit, opened)).map(({ slide }) => slide.id)
}

export async function slideTitles(kit, opened) {
  return (await slidesOf(kit, opened)).map(({ title }) => title)
}

export async function titleSlides(kit, opened, titles) {
  await expect
    .poll(async () => (await slideTitles(kit, opened)).filter(Boolean).length)
    .toBeGreaterThanOrEqual(titles.length)
  const shown = await slideTitles(kit, opened)
  const writes = titles.flatMap((chars, at) => {
    const title = shown[at]
    return title === undefined
      ? []
      : [{ node: title.id, prop: "text", value: { ...title.text, chars, spans: [] }, base: title.base }]
  })
  await editNodes(kit, opened, writes)
  for (const chars of titles)
    await expect(opened.page.locator("[data-slide-entry]").getByText(chars, { exact: true })).toBeVisible()
}

export async function hideNode(kit, opened, id) {
  await editNodes(kit, opened, [{ node: id, prop: "hidden", value: true }])
}

export async function emptySlide(kit, opened) {
  const { nodes } = (await readDoom(kit, opened)).fold
  const held = Object.values(nodes).filter((node) => node.parent?.id === opened.slide)
  await editNodes(
    kit,
    opened,
    held.map((node) => ({ node: node.id, prop: "parent", value: null })),
  )
  await expect(opened.page.locator("[data-slide-box] [data-node]")).toHaveCount(0)
}
