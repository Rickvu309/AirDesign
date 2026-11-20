import { execFileSync } from "node:child_process"
import path from "node:path"
import { expect } from "@playwright/test"

const fixture = "scripts/pptx-fixtures/nested-groups.pptx"
const slide = "ppt/slides/slide1.xml"

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo }) {
  const { cookie } = await signIn()
  await page.goto("./")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().slice(page.url().lastIndexOf("deck/") + "deck/".length)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const canvas = page.locator("[data-slide-paint]")
  const element = (shape) => canvas.locator(`[data-canvas-element="${slide}#${shape}"]`)
  const selection = canvas.locator("[data-selection]")
  const grip = (name) => canvas.locator(`[data-grip="${name}"]`)
  const boxOf = async (shape) => {
    const box = await element(shape).boundingBox()
    if (box === null) throw new Error(`no shape ${shape}`)
    return box
  }
  const middle = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
  const drag = async (from, to) => {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 8 })
    await page.mouse.up()
  }
  const same = (left, right) => ["x", "y", "width", "height"].every((side) => Math.abs(left[side] - right[side]) <= 1.5)
  const rows = async (shape) => {
    const saved = (await post(deckRoutes.open, { deck }, cookie)).json
    const node = Object.keys(saved.register.elements).find((key) => key.endsWith(`.${shape}`))
    return node === undefined ? [] : saved.register.elements[node].landed.filter((row) => row.visible)
  }
  await capture("nested-groups")
  const others = await Promise.all([5, 6, 7].map(boxOf))

  await element(4).click({ modifiers: ["Control"] })
  await expect(selection).toHaveAttribute("data-selection", /\.4$/)
  await expect(canvas.locator('[data-grip^="rotate-"]')).toHaveCount(4)
  await expect(grip("right")).toHaveCount(1)
  await capture("group-layer-selected")

  const before = await boxOf(4)
  await drag(middle(before), { x: middle(before).x + 120, y: middle(before).y + 40 })
  const landedNear = async () => {
    const box = await boxOf(4)
    return Math.abs(box.x - before.x - 120) <= 12 && Math.abs(box.y - before.y - 40) <= 12
  }
  await expect.poll(landedNear).toBe(true)
  expect((await Promise.all([5, 6, 7].map(boxOf))).every((box, at) => same(box, others[at]))).toBe(true)
  await expect.poll(async () => (await rows(4)).length).toBe(1)
  await capture("group-layer-moved")

  const width = await element(4).evaluate((node) => node.getBoundingClientRect().width)
  const right = await grip("right").boundingBox()
  if (right === null) throw new Error("no right grip")
  await drag(middle(right), { x: middle(right).x + 40, y: middle(right).y + 23 })
  await expect.poll(async () => (await rows(4)).length).toBe(2)
  expect(await element(4).evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(width)
  await capture("group-layer-resized")

  const turned = await element(4).evaluate((node) => getComputedStyle(node).transform)
  const centre = middle(await boxOf(4))
  const corner = await grip("rotate-top-right").boundingBox()
  if (corner === null) throw new Error("no rotate grip")
  const from = middle(corner)
  const angle = Math.PI / 4
  const [dx, dy] = [from.x - centre.x, from.y - centre.y]
  const to = {
    x: centre.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: centre.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  }
  await drag(from, to)
  await expect.poll(async () => (await rows(4)).some((row) => row.patch?.box?.rot !== undefined)).toBe(true)
  expect(await element(4).evaluate((node) => getComputedStyle(node).transform)).not.toBe(turned)
  expect((await Promise.all([5, 6, 7].map(boxOf))).every((box, at) => same(box, others[at]))).toBe(true)
  await capture("group-layer-turned")

  const paint = await canvas.boundingBox()
  if (paint === null) throw new Error("no slide")
  await page.mouse.click(paint.x + 20, paint.y + paint.height - 20)
  await expect(selection).toHaveCount(0)
  await element(6).click({ position: { x: 8, y: 8 } })
  await expect(selection).toHaveAttribute("data-selection", /\.2$/)
  const leaf = await boxOf(4)
  const outer = await selection.boundingBox()
  if (outer === null) throw new Error("no selection frame")
  for (const [low, high] of [
    [outer.x, leaf.x],
    [outer.y, leaf.y],
    [leaf.x + leaf.width, outer.x + outer.width],
    [leaf.y + leaf.height, outer.y + outer.height],
  ])
    expect(low).toBeLessThanOrEqual(high + 2)
  await capture("group-fits")

  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  expect(same(await boxOf(4), leaf)).toBe(true)
  expect((await Promise.all([5, 6, 7].map(boxOf))).every((box, at) => same(box, others[at]))).toBe(true)
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "group-transform.pptx")
  await (await downloading).saveAs(exported)
  const diff = execFileSync("node", ["scripts/deck-diff.mjs", path.join(repo, fixture), exported, "--allow", slide], {
    cwd: repo,
    encoding: "utf8",
  })
  expect(diff).toContain("1 changed, 0 added, 0 removed")
  for (const shape of [5, 6, 7]) expect(diff).not.toContain(`p:sp[id=${shape}]`)
  note(
    `nested-groups.pptx: Ctrl+click picked the Leaf two groups down (a group scaled 2x holding a group turned 30° and flipped). It showed resize and rotate grips, moved 120 by 40 px, grew from its right grip and turned 45° from a corner, each one person row on the Leaf in its group's own space, while Twin, Beside and Loose stayed put. A click on Beside picked the outer group, whose frame now holds the moved Leaf. After a reload the Leaf held its place, and the export ${path.basename(exported)} changed only ${slide}: the Leaf's xfrm and its two groups' xfrm, never Twin, Beside or Loose.`,
  )
}
