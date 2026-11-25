import { createHash, randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { packageBuild } from "../../../../scripts/package-build.mjs"
import { designCopy, exportCopy, productCopy, textCopy } from "../bin/product-copy.mjs"
import { clickSlide, dragSlide, node, openDesign, openDoomDeck, readDoom, spot } from "../look/doom-deck.mjs"

const frame = "refreshchart:1"
const rows = [
  { id: "a", label: "North America", value: 18 },
  { id: "b", label: "Europe", value: 27 },
  { id: "c", label: "Asia Pacific", value: 33 },
  { id: "d", label: "Other regions", value: 12 },
]

export async function linkedChart(kit) {
  const doom = await packageBuild(kit.repo, "@airdesign/doom")
  const opened = await openDoomDeck(kit)
  const { page, deck, cookie, slide } = opened
  const read = async () => {
    const fold = doom.readFold((await readDoom(kit, opened)).fold)
    if (fold === undefined) throw Error("Unreadable fold")
    return fold
  }
  const send = async (fold, writes, author = { kind: "person", id: "another-tab" }) => {
    if (doom.isRefusal(writes)) throw Error(JSON.stringify(writes))
    const reply = await kit.post(
      kit.doomRoutes.edit,
      {
        deck,
        edit: {
          once: randomUUID(),
          author,
          readBase: fold.rev,
          writes,
          ...(author.kind === "agent" ? { phase: "start" } : {}),
        },
      },
      cookie,
    )
    kit.expect(reply.json, JSON.stringify(reply.json)).toMatchObject({ ok: true })
  }
  const chart = (fold) => doom.propOf(fold.nodes.get(frame), "instance")
  const part = (fold, role, id) => chart(fold).parts.find(({ key }) => key[0] === role && key[1] === id)?.node
  const before = await read()
  const measure = doom.measureWith({})
  const placed = doom.placeComponent(before, doom.columnDefinition, {
    frame,
    parent: { id: slide, at: doom.orderKeyBetween(null, null) },
    box: spot(245, 180, 1430, 690),
    data: { rows },
    tokens: { title: "Revenue by region", unitHeader: "$M" },
    measure,
  })
  if (doom.isRefusal(placed)) throw Error(JSON.stringify(placed))
  await send(before, [
    ...doom.childrenOf(before, slide).map(({ id }) => ({ node: id, prop: "parent", value: null })),
    ...placed,
  ])
  await kit.expect(node(page, frame)).toBeAttached()
  await openDesign(page)
  const selectChart = async () => {
    const bar = part(await read(), "bar", "b")
    const bounds = await node(page, bar).boundingBox()
    if (bounds === null) throw Error("Chart bar is not painted")
    await page.keyboard.press("Escape")
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await kit.expect(page.locator(`[data-selection-outline="${frame}"]`)).toBeAttached()
  }
  await selectChart()
  return { ...opened, chart, doom, frame, measure, part, read, selectChart, send }
}

export default async function drive(kit) {
  const { page, expect, context, capture, note } = kit
  await page.addInitScript(() => {
    window.print = () => {}
  })
  const { deck, slide, cookie, chart, doom, measure, part, read, selectChart, send } = await linkedChart(kit)
  const detach = page.getByRole("button", { name: designCopy.detachInstance, exact: true })
  await expect(detach).toBeVisible()
  await capture("linked-chart-design")

  const settled = () => expect(page.locator('[data-save-status="saved"]')).toBeAttached({ timeout: 20_000 })
  const readUntil = (check) => expect.poll(async () => check(await read()), { timeout: 20_000 })
  const themePicker = page.getByRole("combobox", { name: /^Change theme/ })
  const first = await read()
  const oldBar = part(first, "bar", "a")
  const swatch = () => node(page, oldBar).locator('[data-paint="solid"]').first().getAttribute("style")
  const oldPaint = await swatch()
  await clickSlide(page, 78, 65)
  const held = await kit.holdReply(kit.doomRoutes.edit)
  try {
    await themePicker.click()
    await page.getByRole("option", { name: "Editorial" }).click()
    await expect(themePicker).toHaveAccessibleName(designCopy.chooseTheme("Editorial"))
    await expect.poll(swatch).not.toBe(oldPaint)
    await held.received
    expect((await read()).rev).toBe(first.rev)
    await capture("theme-before-save")
  } finally {
    await held.release()
  }
  await readUntil((fold) => fold.rev).toBe(first.rev + 1)
  const themed = await read()
  expect(doom.libraryThemeOf(doom.deckOf(themed).theme)?.name).toBe("Editorial")
  expect(themed.revs.get(frame).get("instance")).toBe(themed.rev)
  await settled()

  const tab = await context.newPage()
  await tab.goto(page.url())
  await expect(node(tab, oldBar)).toBeAttached()
  const oldWidth = (await node(tab, oldBar).boundingBox()).width
  await selectChart()
  await dragSlide(page, { x: 1675, y: 870 }, { x: 1180, y: 760 })
  await readUntil((fold) => doom.propOf(fold.nodes.get(frame), "box").w).toBeLessThan(1200)
  const resized = await read()
  expect(resized.rev).toBe(themed.rev + 1)
  expect(doom.propOf(resized.nodes.get(chart(resized).generated), "box").w).toBe(
    doom.propOf(resized.nodes.get(frame), "box").w,
  )
  await expect.poll(async () => (await node(tab, oldBar).boundingBox()).width).toBeLessThan(oldWidth)
  await capture("linked-chart-resized")
  await settled()

  const label = part(resized, "category", "a")
  const labelBox = await node(page, label).boundingBox()
  await page.keyboard.down("ControlOrMeta")
  await page.mouse.click(labelBox.x + labelBox.width / 2, labelBox.y + labelBox.height / 2)
  await page.keyboard.up("ControlOrMeta")
  await page.getByRole("combobox", { name: textCopy.style, exact: true }).click()
  await page
    .getByRole("option", { name: /^Body(?: ·|$)/ })
    .first()
    .click()
  await readUntil((fold) => doom.propOf(fold.nodes.get(label), "text")?.style).toBe("body")
  const styled = await read()
  expect(styled.rev).toBe(resized.rev + 1)
  expect(styled.revs.get(frame).get("instance")).toBe(styled.rev)
  await capture("linked-chart-label-style")
  await settled()

  await selectChart()
  await context.setOffline(true)
  await detach.click()
  await expect(detach).toHaveCount(0)
  expect(chart(await read())).toBeDefined()
  await capture("linked-chart-detached-offline")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(detach).toBeVisible()
  await context.setOffline(false)
  await settled()
  const reattached = await read()
  expect(chart(reattached)).toEqual(chart(styled))

  const data = {
    rows: Array.from({ length: 100 }, (_, i) => ({
      id: i < rows.length ? rows[i].id : `region-${i}`,
      label: i < rows.length ? rows[i].label : `Region ${i + 1}`,
      value: 10 + (i % 37),
    })),
  }
  const refreshed = doom.regenerateComponent(reattached, frame, { data }, measure)
  if (doom.isRefusal(refreshed)) throw Error(JSON.stringify(refreshed))
  await send(reattached, refreshed.writes, {
    kind: "agent",
    id: "chart-data",
    run: "chart-data-refresh",
    name: productCopy.agentName,
  })
  const saved = await read()
  const bars = chart(saved).parts.filter(({ key }) => key[0] === "bar")
  expect(bars).toHaveLength(100)
  expect(saved.rev).toBe(reattached.rev + 1)
  const last = bars.at(-1).node
  await expect(node(tab, last)).toBeAttached()
  await page.reload()
  await expect(node(page, last)).toBeAttached()
  await expect(page.locator(`[data-slide-thumb] [data-node="${last}"]`).first()).toBeAttached()
  const overview = await capture("linked-chart-100-rows")
  const key = createHash("sha256").update(doom.slideKeyText(saved, slide)).digest("hex")
  const captureRequest = page.waitForResponse((response) => {
    if (new URL(response.url()).pathname !== kit.doomRoutes.pictures.path || !response.ok()) return false
    return response
      .request()
      .postDataJSON()
      .pictures.images.some((image) => image.key === key)
  })
  await Promise.all([
    captureRequest,
    fetch(`${kit.origin}${kit.mcpRoutes.mcp.path}`, {
      method: "POST",
      headers: { cookie, accept: "application/json, text/event-stream", "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "airdesign_read_deck", arguments: { deck, slide, picture: true } },
      }),
    }).then(async (response) => expect(response.ok, await response.text()).toBe(true)),
  ])
  const captured = await captureRequest
  const image = captured
    .request()
    .postDataJSON()
    .pictures.images.find((image) => image.key === key)
  expect((await captured.json()).ok).toBe(true)
  await writeFile(join(dirname(overview), "linked-chart.jpg"), Buffer.from(image.data, "base64"))

  await page.getByRole("button", { name: productCopy.exportDeck, exact: true }).click()
  await page
    .getByRole("dialog", { name: exportCopy.title })
    .getByRole("button", { name: exportCopy.action, exact: true })
    .click()
  await expect(page.locator(`[data-print-page] [data-node="${last}"]`)).toBeAttached()
  const pdf = await page.pdf({ preferCSSPageSize: true })
  const { pdfPages } = await import("../../../../tests/browser/pdf-file.ts")
  const [printed] = pdfPages(pdf)
  expect(printed?.box).toEqual([0, 0, 960, 540])
  expect(printed?.content).toMatch(/\b(?:S|f\*?)\b/)
  await writeFile(join(dirname(overview), "linked-chart.pdf"), pdf)
  await tab.close()
  note(
    "Theme painted before a held save. The second tab received the resize, detach and undo replayed after reconnect, and a 100-row refresh survived reopen, filmstrip, JPEG capture and PDF.",
  )
}
