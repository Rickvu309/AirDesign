import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { frameCopy } from "../bin/product-copy.mjs"
import { clickSlide, dragSlide, openDesign, readDoom, slowPaint } from "./doom-deck.mjs"

export function lineEnds(saved, line) {
  const { start, end } = saved.nodes[line.id].geometry
  return [start.node, end.node]
}

export async function center(page, id) {
  const box = await page.locator(`[data-slide-box] [data-node="${id}"]`).first().boundingBox()
  if (box === null) throw new Error(`${id} is not painted`)
  const slide = await page.locator("[data-slide-box]").boundingBox()
  const scale = 1920 / slide.width
  return { x: (box.x - slide.x + box.width / 2) * scale, y: (box.y - slide.y + box.height / 2) * scale }
}

export async function moveColumnStep(kit, { opened, tree, saved, out }) {
  const { page, capture, note } = kit
  const part = (...key) => tree.children.find((child) => child.key.join("/") === key.join("/"))
  const card = part("card", "s1")
  const duration = part("duration", "s1")
  const step = tree.groups.find(({ key }) => key.join("/") === "step/s1")
  expect([card.group, duration.group]).toEqual([step.id, step.id])
  const connectors = tree.children.filter(({ key }) => key[0] === "connector")
  const before = connectors.map((line) => lineEnds(saved, line))
  const from = await center(page, card.id)
  const durationFrom = await center(page, duration.id)
  await page.keyboard.press("Escape")
  await openDesign(page)
  await clickSlide(page, from.x, from.y)
  await expect(page.locator("[data-selection-outline]")).toHaveAttribute("data-selection-outline", tree.id)
  await page.locator("[data-design-panel]").getByRole("button", { name: frameCopy.removeAutoLayout }).click()
  await expect.poll(async () => (await readDoom(kit, opened)).fold.nodes[tree.id].layout?.mode).toBe("none")
  await clickSlide(page, from.x, from.y, { double: true })
  await expect(page.locator("[data-selection-outline]")).toHaveAttribute("data-selection-outline", step.id)
  const placed = (await readDoom(kit, opened)).fold.nodes[step.id].box
  await dragSlide(page, from, { x: from.x + 300, y: from.y + 40 })
  await expect
    .poll(async () => (await readDoom(kit, opened)).fold.nodes[step.id].box.x, slowPaint)
    .toBeGreaterThan(placed.x + 240)
  const after = (await readDoom(kit, opened)).fold
  expect(after.nodes[card.id].box).toEqual(saved.nodes[card.id].box)
  expect(after.nodes[duration.id].box).toEqual(saved.nodes[duration.id].box)
  expect(connectors.map((line) => lineEnds(after, line))).toEqual(before)
  const cardTo = await center(page, card.id)
  const durationTo = await center(page, duration.id)
  expect(Math.abs(cardTo.x - from.x - (durationTo.x - durationFrom.x))).toBeLessThanOrEqual(1)
  expect(Math.abs(cardTo.y - from.y - (durationTo.y - durationFrom.y))).toBeLessThanOrEqual(1)
  expect(cardTo.x - from.x).toBeGreaterThan(240)
  await capture("process-column-step-moved")
  await writeFile(join(out, "process-column-step-moved-slide.png"), await page.locator("[data-slide-box]").screenshot())
  note(
    "process column: after Remove auto layout, double-clicking step 2 picks its group; dragging it moves the card and its duration together and both connectors stay attached.",
  )
}
