import { copyFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Locator } from "@playwright/test"
import { forward, signInBrowser, test } from "./api-stack"
import { exportFromDialog } from "./export-dialog"
import { partsOf } from "./shape-fills"

const exportName = "exported-agent-arrow.pptx"
const original = join(process.cwd(), "scripts/pptx-fixtures/shapes-added.pptx")
const slidePart = "ppt/slides/slide1.xml"
const bound = '<a:stCxn id="4" idx="3"/><a:endCxn id="5" idx="2"/>'

test.use({ viewport: { width: 1600, height: 1000 } })

function placement(element: Locator): Promise<readonly string[]> {
  return element.evaluate((node: HTMLElement) => [node.style.left, node.style.top, node.style.width, node.style.height])
}

test("an agent adds an arrow from the rectangle to the oval, which the person sees, drags the oval under, and the export keeps bound @export", async ({
  page,
  context,
  stack,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", exportName)
  await rm(judged, { force: true })
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open(original)
  await expect.poll(async () => (await stack.callTool("airdesign_read_deck", { deck }, cookie)).index).toBe("ready")
  const read = await stack.callTool("airdesign_read_deck", { deck }, cookie)
  const slide = String((read.slides as readonly { readonly id: string }[])[0]?.id)
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const connection = {
    start: { shape: { node: `${slide}.4`, site: 3 } },
    end: { shape: { node: `${slide}.5`, site: 2 } },
  }
  const change = { op: "add", kind: "arrow", slide, connection }
  const added = await stack.callTool("airdesign_edit_deck", { deck, base, changes: [change] }, cookie)
  expect(added).toMatchObject({ ok: true, elements: [{ node: `${slide}.7` }] })

  const arrow = page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#7"]`)
  await expect(arrow.locator("[data-canvas-line]")).toBeVisible()
  const placed = await placement(arrow)
  const oval = page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#5"]`)
  const box = await oval.boundingBox()
  if (box === null) throw new Error("no oval")
  await oval.click({ position: { x: 4, y: box.height / 2 } })
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 90, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => placement(arrow)).not.toEqual(placed)

  const file = testInfo.outputPath(exportName)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  await (await saving).saveAs(file)
  const before = await partsOf(original)
  const saved = await partsOf(file)
  const xml = saved.get(slidePart)?.toString("utf8") ?? ""
  expect(xml).toContain(bound)
  expect(xml).toContain('<a:prstGeom prst="straightConnector1">')
  expect(xml).toContain('<a:tailEnd type="triangle"/>')
  const changed = [...before].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([slidePart])
  await copyFile(file, judged)
})

const elbowName = "exported-agent-elbow.pptx"
const under = '<a:stCxn id="4" idx="2"/><a:endCxn id="5" idx="4"/>'

test("an agent adds an elbow under the rectangle and the oval, bottom site to bottom site, and the export keeps it bound @export", async ({
  page,
  context,
  stack,
  decks,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", elbowName)
  await rm(judged, { force: true })
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open(original)
  await expect.poll(async () => (await stack.callTool("airdesign_read_deck", { deck }, cookie)).index).toBe("ready")
  const read = await stack.callTool("airdesign_read_deck", { deck }, cookie)
  const slide = String((read.slides as readonly { readonly id: string }[])[0]?.id)
  const base = (await stack.post("/decks/open", { deck }, cookie)).json.revision
  const connection = {
    start: { shape: { node: `${slide}.4`, site: 2 } },
    end: { shape: { node: `${slide}.5`, site: 4 } },
  }
  const change = { op: "add", kind: "elbow", slide, connection }
  const added = await stack.callTool("airdesign_edit_deck", { deck, base, changes: [change] }, cookie)
  expect(added).toMatchObject({ ok: true, elements: [{ node: `${slide}.7` }] })
  const elbow = page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#7"]`)
  await expect(elbow.locator("[data-canvas-line]")).toBeVisible()

  const file = testInfo.outputPath(elbowName)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  await (await saving).saveAs(file)
  const before = await partsOf(original)
  const saved = await partsOf(file)
  const xml = saved.get(slidePart)?.toString("utf8") ?? ""
  expect(xml).toContain(under)
  expect(xml).toContain('<a:prstGeom prst="bentConnector3">')
  const changed = [...before].filter(([name, bytes]) => saved.get(name)?.equals(bytes) !== true)
  expect(changed.map(([name]) => name)).toEqual([slidePart])
  await copyFile(file, judged)
})
