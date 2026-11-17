import { setPanelMode } from "../look/panel-mode.mjs"
import path from "node:path"
import { expect } from "@playwright/test"

const census = "scripts/pptx-fixtures/census-updating-spm.pptx"
const blank = "scripts/pptx-fixtures/blank.pptx"
const slide = "ppt/slides/slide10.xml"
const slideWidth = 12_192_000
const card = { x: 3_948_437, y: 4_728_663, cx: 914_400, cy: 914_400 }

async function opened(page, repo, fixture) {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, fixture))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  return deck
}

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo, aira }) {
  const { cookie } = await signIn()
  const deck = await opened(page, repo, census)
  const canvas = page.locator("[data-slide-paint]")
  const element = (shape) => canvas.locator(`[data-canvas-element="${slide}#${shape}"]`)
  const placement = (shape) =>
    element(shape).evaluate((frame) => {
      const paint = frame.closest("[data-slide-paint]")
      const scale = Number.parseFloat(paint.style.width)
      return [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((value) =>
        Math.round((Number.parseFloat(value) / scale) * 1_000_000),
      )
    })
  const saved = async (id) => (await post(deckRoutes.open, { deck: id }, cookie)).json
  const point = async (x, y) => {
    const paint = await canvas.boundingBox()
    if (paint === null) throw new Error("no slide")
    const scale = paint.width / slideWidth
    return { x: paint.x + x * scale, y: paint.y + y * scale }
  }

  await page.locator('[data-slide-entry="10"]').click()
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const line = await element(26).boundingBox()
  if (line === null) throw new Error("no connector")
  await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2)
  await expect(page.locator("[data-design-element]")).toHaveAttribute("data-design-element", /\.26$/)
  const file = await placement(26)
  await setPanelMode(page, "design")
  const section = page
    .locator("[data-design-element] section")
    .filter({ has: page.getByRole("heading", { name: "Connector", exact: true }) })
  if ((await section.count()) > 0) await section.scrollIntoViewIfNeeded()
  await capture("connector-panel")

  const grip = page.locator('[data-connector-end="end"]')
  if ((await grip.count()) === 0) {
    const corner = await element(26).boundingBox()
    await page.mouse.move(corner.x + corner.width - 2, corner.y + corner.height - 2)
    await capture("connector-aim")
    note("This build has no connector ends to drag. The selected connector shows its box's corners.")
  } else {
    const end = await grip.boundingBox()
    const right = await point(card.x + card.cx, card.y + card.cy / 2)
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2)
    await page.mouse.down()
    await page.mouse.move(right.x - 24, right.y + 8, { steps: 4 })
    await page.mouse.move(right.x - 2, right.y + 1, { steps: 2 })
    await expect(page.locator("[data-connector-chosen]")).toHaveAttribute("data-connector-site", "3")
    await capture("connector-aim")
    await page.mouse.up()
    await expect.poll(() => placement(26)).not.toEqual(file)
    await expect.poll(async () => JSON.stringify((await saved(deck)).register.elements)).toContain('"site":3}')
    const bound = await placement(26)
    await capture("connector-bound")

    const picture = await element(15).boundingBox()
    await page.mouse.move(picture.x + picture.width / 2, picture.y + picture.height / 2)
    await page.mouse.down()
    await page.mouse.move(picture.x + picture.width / 2 + 60, picture.y + picture.height / 2 - 40, { steps: 6 })
    await page.mouse.up()
    await expect.poll(() => placement(26)).not.toEqual(bound.map((value) => expect.closeTo(value, -1)))
    const followed = await placement(26)
    await capture("connector-followed")
    await page.getByRole("button", { name: "Undo move", exact: true }).click()
    await expect.poll(() => placement(26)).toEqual(bound.map((value) => expect.closeTo(value, -1)))
    await page.getByRole("button", { name: "Redo move", exact: true }).click()
    await expect.poll(() => placement(26)).toEqual(followed.map((value) => expect.closeTo(value, -1)))

    await page.reload()
    await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
    await page.locator('[data-slide-entry="10"]').click()
    await expect.poll(() => placement(26)).toEqual(followed.map((value) => expect.closeTo(value, -1)))
    const downloading = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export", exact: true }).click()
    await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
    await page.keyboard.press("Enter")
    const out = path.dirname(await capture("exported"))
    const exported = path.join(out, "connector-diagram.pptx")
    await (await downloading).saveAs(exported)
    await page.goto("/")
    await page.locator("input[type=file]").setInputFiles(exported)
    await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
    await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", page.url().split("/").at(-1))
    await page.locator('[data-slide-entry="10"]').click()
    await expect.poll(() => placement(26)).toEqual(followed.map((value) => expect.closeTo(value, -1)))
    await capture("connector-reimported")
  }

  const flow = await opened(page, repo, blank)
  const base = Number((await saved(flow)).revision)
  aira([{ name: "diagram.sse", fill: { deck: flow, base: String(base), slide: "256" } }, { name: "diagrammed.sse" }])
  const panel = page.locator("[data-editor-panel]")
  await page.getByRole("textbox", { name: "Ask Aira" }).fill("Add a three-step flow: Plan, Build, Ship")
  await page.keyboard.press("Enter")
  const answered = panel.getByText("The slide now shows Plan, Build and Ship, each joined to the next by an arrow.")
  await expect(answered.or(panel.getByRole("button", { name: "Try again", exact: true }))).toBeVisible()
  const last = (await saved(flow)).register.order.at(-1)
  if (last?.slide !== "element-group") {
    await capture("diagram-made")
    note("This build has no diagram change. Aira's diagram call did not land and the slide stayed blank.")
    return
  }
  expect(last).toMatchObject({ slide: "element-group", runId: expect.any(String) })
  const added = (await saved(flow)).register.order.filter((command) => command.slide === "element-add")
  expect(added.map((command) => command.element.kind)).toEqual(["shape", "shape", "shape", "connector", "connector"])
  for (const words of ["Plan", "Build", "Ship"]) await expect(canvas.getByText(words, { exact: true })).toBeVisible()
  await capture("diagram-made")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("diagram-exported"))
  const exported = path.join(out, "diagram.pptx")
  await (await downloading).saveAs(exported)

  await panel.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(canvas.getByText("Plan", { exact: true })).toHaveCount(0)
  await expect.poll(async () => (await saved(flow)).register.order.at(-1)?.slide).not.toBe("element-group")
  await capture("diagram-undone")

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", page.url().split("/").at(-1))
  for (const words of ["Plan", "Build", "Ship"]) await expect(canvas.getByText(words, { exact: true })).toBeVisible()
  await capture("diagram-reimported")
}
