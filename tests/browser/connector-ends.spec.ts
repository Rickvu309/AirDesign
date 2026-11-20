import { boxCopy } from "../../apps/web/src/copy/box-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { exportFromDialog } from "./export-dialog"
import { fixtures, openDeck, unfold } from "./design-panel"
import { partsOf } from "./shape-fills"
import { outline } from "./shape-turns"
import { test } from "./deck-test"

test.use({ viewport: { width: 1600, height: 1000 } })

const exportName = "exported-connection.pptx"
const judged = join(process.cwd(), "tests/browser", exportName)
const slidePart = "ppt/slides/slide10.xml"
const slideWidth = 12_192_000
const card = { x: 3_948_437, y: 4_728_663, cx: 914_400, cy: 914_400 }

function frame(page: Page, shape: string, part = slidePart): Locator {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${shape}"]`)
}

function turn(element: Locator): Promise<string> {
  return element.evaluate((node: HTMLElement) => node.style.transform)
}

function placement(element: Locator): Promise<readonly string[]> {
  return element.evaluate((node: HTMLElement) => [node.style.left, node.style.top, node.style.width, node.style.height])
}

async function point(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("no slide")
  const scale = slide.width / slideWidth
  return { x: slide.x + x * scale, y: slide.y + y * scale }
}

async function pickConnector(page: Page) {
  const line = await frame(page, "26").boundingBox()
  if (line === null) throw new Error("no connector")
  await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2)
  await expect(page.locator("[data-connector-end]")).toHaveCount(2)
}

test("a person drags a connector's end onto a site the hovered picture shows, moves that picture offline, and the connector follows before the network, through Undo, a reload, the export and a new import @export", async ({
  page,
  decks,
}, testInfo) => {
  await rm(judged, { force: true })
  await openDeck(page, "census-updating-spm.pptx")
  await page.locator('[data-slide-entry="10"]').click()
  const line = frame(page, "26")
  const file = await placement(line)
  await pickConnector(page)
  await expect(page.locator("[data-grip='top-left']")).toHaveCount(0)

  const grip = await page.locator('[data-connector-end="end"]').boundingBox()
  if (grip === null) throw new Error("no end")
  const right = await point(page, card.x + card.cx, card.y + card.cy / 2)
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(right.x - 20, right.y + 6, { steps: 4 })
  await page.mouse.move(right.x - 2, right.y + 1, { steps: 2 })
  await expect(page.locator(`[data-connector-target$=".15"]`)).toHaveCount(4)
  await expect(page.locator("[data-connector-chosen]")).toHaveAttribute("data-connector-site", "3")
  await page.mouse.up()
  await expect(page.locator("[data-connector-site]")).toHaveCount(0)
  await expect.poll(() => placement(line)).not.toEqual(file)
  const bound = await placement(line)
  await expect(page.getByRole("button", { name: "Undo connector", exact: true })).toBeVisible()

  await page.context().setOffline(true)
  const picture = await frame(page, "15").boundingBox()
  if (picture === null) throw new Error("no picture")
  await page.mouse.move(picture.x + picture.width / 2, picture.y + picture.height / 2)
  await page.mouse.down()
  await page.mouse.move(picture.x + picture.width / 2 + 60, picture.y + picture.height / 2 - 40, { steps: 6 })
  await expect.poll(() => placement(line)).not.toEqual(bound)
  const dragging = await placement(line)
  await page.mouse.up()
  await expect.poll(() => placement(line)).toEqual(dragging)
  const followed = await placement(line)
  await page.getByRole("button", { name: "Undo move", exact: true }).click()
  await expect.poll(() => placement(line)).toEqual(bound)
  await page.getByRole("button", { name: "Redo move", exact: true }).click()
  await expect.poll(() => placement(line)).toEqual(followed)
  await page.context().setOffline(false)

  await page.reload()
  await decks.ready()
  await page.locator('[data-slide-entry="10"]').click()
  await expect.poll(() => placement(frame(page, "26"))).toEqual(followed)

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const saved = testInfo.outputPath(exportName)
  await (await saving).saveAs(saved)
  const original = await partsOf(join(fixtures, "census-updating-spm.pptx"))
  const exported = await partsOf(saved)
  const slide = exported.get(slidePart)?.toString("utf8") ?? ""
  expect(slide).toContain('<a:stCxn id="6" idx="2"/><a:endCxn id="15" idx="3"/>')
  expect(slide).toContain('<a:prstGeom prst="line"><a:avLst/></a:prstGeom>')
  const changed = [...original].filter(([name, bytes]) => exported.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([slidePart])
  await copyFile(saved, judged)

  await decks.open(saved)
  await page.locator('[data-slide-entry="10"]').click()
  await expect.poll(() => placement(frame(page, "26"))).toEqual(followed)
})

const elbowName = "exported-elbow.pptx"
const elbowJudged = join(process.cwd(), "tests/browser", elbowName)
const deckSlide = "ppt/slides/slide1.xml"

function adjustOf(slide: string, id: string): string | undefined {
  const at = slide.indexOf(`<p:cNvPr id="${id}"`)
  return /name="adj1" fmla="val (-?\d+)"/.exec(slide.slice(at))?.[1]
}

async function dragBy(page: Page, element: Locator, dx: number, dy: number) {
  await element.click()
  const box = await element.boundingBox()
  if (box === null) throw new Error("no element box")
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 })
}

test("both elbow connectors follow Build while a person drags it, bend as their sites ask, and export with their adjust values @export", async ({
  page,
}, testInfo) => {
  await rm(elbowJudged, { force: true })
  await openDeck(page, "connectors.pptx")
  const between = frame(page, "4", deckSlide)
  const under = frame(page, "5", deckSlide)
  const files = [await placement(between), await placement(under)]
  expect(await turn(under)).toBe("rotate(270deg) scale(-1, 1)")

  await dragBy(page, frame(page, "3", deckSlide), 0, 60)
  await expect.poll(() => placement(between)).not.toEqual(files[0])
  await expect.poll(() => placement(under)).not.toEqual(files[1])
  const dragging = [await placement(between), await placement(under)]
  expect(await turn(under)).toBe("rotate(270deg) scale(-1, 1)")
  await page.mouse.up()
  await expect.poll(() => placement(between)).toEqual(dragging[0])
  await expect.poll(() => placement(under)).toEqual(dragging[1])

  await page.getByRole("button", { name: "Undo move", exact: true }).click()
  await expect.poll(() => placement(between)).toEqual(files[0])
  await expect.poll(() => placement(under)).toEqual(files[1])
  await page.getByRole("button", { name: "Redo move", exact: true }).click()
  await expect.poll(() => placement(under)).toEqual(dragging[1])

  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const saved = testInfo.outputPath(elbowName)
  await (await saving).saveAs(saved)
  const original = await partsOf(join(fixtures, "connectors.pptx"))
  const exported = await partsOf(saved)
  const slide = exported.get(deckSlide)?.toString("utf8") ?? ""
  expect(slide).toContain('<a:stCxn id="2" idx="3"/><a:endCxn id="3" idx="1"/>')
  expect(slide).toContain('<a:stCxn id="2" idx="2"/><a:endCxn id="3" idx="2"/>')
  expect(adjustOf(slide, "4")).toBe("50000")
  expect(Number(adjustOf(slide, "5"))).toBeLessThan(115_000)
  const changed = [...original].filter(([name, bytes]) => exported.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([deckSlide])
  await copyFile(saved, elbowJudged)
})

test("a person drags a connector's end off its shape to a point on the slide, and Undo puts it back on its site", async ({
  page,
  decks,
}) => {
  await openDeck(page, "connectors.pptx")
  const between = frame(page, "4", deckSlide)
  const file = await placement(between)
  const bend = await point(page, 4_572_000, 3_619_500)
  await page.mouse.click(bend.x, bend.y)
  await expect(page.locator("[data-connector-end]")).toHaveCount(2)
  await expect(page.locator("[data-grip]")).toHaveCount(0)

  const grip = await page.locator('[data-connector-end="end"]').boundingBox()
  if (grip === null) throw new Error("no end")
  const free = await point(page, 6_500_000, 1_200_000)
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(free.x, free.y, { steps: 6 })
  await expect(page.locator("[data-connector-site]")).toHaveCount(0)
  await page.mouse.up()
  await expect(page.getByRole("button", { name: "Undo connector", exact: true })).toBeVisible()
  await expect.poll(() => placement(between)).not.toEqual(file)
  const freed = await placement(between)
  const end = page.locator('[data-connector-end="end"]')
  await expect
    .poll(async () => {
      const box = await end.boundingBox()
      return box === null ? Infinity : Math.hypot(box.x + box.width / 2 - free.x, box.y + box.height / 2 - free.y)
    })
    .toBeLessThan(2)

  await page.getByRole("button", { name: "Undo connector", exact: true }).click()
  await expect.poll(() => placement(between)).toEqual(file)
  await page.getByRole("button", { name: "Redo connector", exact: true }).click()
  await expect.poll(() => placement(between)).toEqual(freed)
  await page.reload()
  await decks.ready()
  await expect.poll(() => placement(frame(page, "4", deckSlide))).toEqual(freed)
})

test("an elbow connector follows Build through a corner resize and a turn in the Design panel, offline", async ({
  page,
}) => {
  await openDeck(page, "connectors.pptx")
  await page.context().setOffline(true)
  const build = frame(page, "3", deckSlide)
  const under = frame(page, "5", deckSlide)
  const file = { place: await placement(under), path: await outline(under) }
  await build.click({ position: { x: 20, y: 20 } })
  const corner = await page.locator("[data-selection] [data-grip='bottom-right']").boundingBox()
  if (corner === null) throw new Error("no corner")
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2)
  await page.mouse.down()
  await page.mouse.move(corner.x + corner.width / 2 + 40, corner.y + corner.height / 2 + 30, { steps: 6 })
  await expect.poll(() => placement(under)).not.toEqual(file.place)
  await expect.poll(() => outline(under)).not.toBe(file.path)
  const resizing = await placement(under)
  await page.mouse.up()
  await expect.poll(() => placement(under)).toEqual(resizing)

  await page.getByRole("button", { name: "Design", exact: true }).click()
  await unfold(page.locator("[data-design-element]"), boxCopy.section)
  const rotation = page.locator("[data-design-element]").getByRole("textbox", { name: "Rotation", exact: true })
  await expect(rotation).toBeVisible()
  const resized = await placement(under)
  await rotation.fill("90")
  await rotation.press("Enter")
  await expect.poll(() => placement(under)).not.toEqual(resized)
  await page.getByRole("button", { name: "Undo rotate", exact: true }).click()
  await expect.poll(() => placement(under)).toEqual(resized)
  await page.context().setOffline(false)
})

function segments(path: string): number {
  return path.match(/L/g)?.length ?? 0
}

test("an elbow goes around in five segments while a person drags Build behind Plan, and keeps them after the drop", async ({
  page,
}) => {
  await openDeck(page, "connectors.pptx")
  const between = frame(page, "4", deckSlide)
  expect(segments(await outline(between))).toBe(3)
  await dragBy(page, frame(page, "3", deckSlide), -340, 40)
  await expect.poll(async () => segments(await outline(between))).toBe(5)
  await page.mouse.up()
  await expect.poll(async () => segments(await outline(between))).toBe(5)
  await page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true }).click()
  await expect.poll(async () => segments(await outline(between))).toBe(3)
})
