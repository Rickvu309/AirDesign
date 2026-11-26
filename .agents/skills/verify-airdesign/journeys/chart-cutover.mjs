import { airaCopy, designCopy, editorCopy } from "../bin/product-copy.mjs"
import { connectOutsideAgent } from "./aira-panel.mjs"
import { node, openDesign, openDoomDeck, readDoom } from "../look/doom-deck.mjs"
import { addSlideStart } from "../look/doom-slides.mjs"

const inserts = ["column", "bar", "stacked", "waterfall", "line", "pie"]

export default async function drive(kit) {
  const { page, expect, capture, note, doomRoutes, mcpRoutes, aira, holdReply } = kit
  const opened = await openDoomDeck(kit)
  const { deck, cookie } = opened
  const read = () => readDoom(kit, opened)
  const call = await connectOutsideAgent(kit, cookie, "Chart cutover")
  const actions = page.getByRole("button", { name: editorCopy.actions, exact: true })
  const insert = async (kind) => {
    await actions.click()
    await page.getByRole("option", { name: editorCopy.chartKinds[kind], exact: true }).click()
    const selection = page.locator("[data-selection-outline]")
    await expect(selection).toHaveCount(1)
    return selection.getAttribute("data-selection-outline")
  }

  let column
  for (const kind of inserts) {
    await addSlideStart(page, editorCopy.slideStarts.blank)
    const id = await insert(kind)
    const component = kind === "bar" ? "clustered-chart" : kind
    await expect.poll(async () => (await read()).fold.nodes[id]?.instance?.component.id).toBe(component)
    const frame = (await read()).fold.nodes[id]
    if (kind === "column") column = frame
    expect(frame.instance.parts.length).toBeGreaterThan(4)
    await expect(node(page, frame.instance.parts[0].node)).toBeAttached()
    await expect(page.locator(`[data-slide-thumb] [data-node="${id}"]`)).toBeAttached()
    await capture(`insert-${kind}`)
  }

  await addSlideStart(page, editorCopy.slideStarts.blank)
  const waterfall = await insert("waterfall")
  await expect.poll(async () => (await read()).fold.nodes[waterfall]?.instance?.component.id).toBe("waterfall")
  const { fold } = await read()
  const chart = fold.nodes[waterfall]
  const part = chart.instance.parts.find(({ node }) => fold.nodes[node]?.type === "shape")
  expect(part).toBeDefined()
  await openDesign(page)
  const mark = node(page, part.node)
  await expect(mark).toBeAttached()
  const bounds = await mark.boundingBox()
  expect(bounds).not.toBeNull()
  await page.mouse.dblclick(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  const selected = await page.locator("[data-selection-outline]").getAttribute("data-selection-outline")
  expect(selected).not.toBe(waterfall)
  expect(fold.nodes[selected]?.type).toBe("frame")
  await expect(page.locator("[data-design-panel]")).toHaveAttribute("data-design-element", waterfall)
  await expect(page.getByRole("button", { name: designCopy.detachInstance })).toBeVisible()
  await expect(page.locator("[data-design-panel]").getByText(chart.name, { exact: true })).toBeVisible()
  await capture("chart-part-instance-panel")
  const colorNames = page.locator("[data-selection-colors] button:first-child")
  await expect(colorNames).toHaveCount(2)
  for (const color of await colorNames.all()) await expect(color).not.toHaveAccessibleName(/^[A-F0-9]{6}$/)
  const label = chart.instance.parts.find(({ key }) => key[0] === "category")
  expect(label).toBeDefined()
  const labelBounds = await node(page, label.node).boundingBox()
  expect(labelBounds).not.toBeNull()
  const labelX = labelBounds.x + labelBounds.width / 2
  const labelY = labelBounds.y + labelBounds.height / 2
  await page.mouse.dblclick(labelX, labelY)
  await page.mouse.dblclick(labelX, labelY)
  await expect(page.locator(`[data-selection-outline="${label.node}"]`)).toBeAttached()
  await capture("chart-label-double-click")
  await expect(page.locator("[data-text-editor]")).toHaveCount(0)
  await page.mouse.dblclick(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  const newChart = await insert("column")
  await expect.poll(async () => (await read()).fold.nodes[newChart]?.instance?.component.id).toBe("column")
  await expect.poll(async () => (await read()).fold.nodes[newChart]?.parent?.id).toBe(chart.parent.id)
  await capture("insert-with-part-selected")
  note(
    "Double-clicking a chart selected its generated frame and opened the instance panel. Actions inserted the next chart on the same slide.",
  )

  await addSlideStart(page, editorCopy.slideStarts.blank)
  const paths = new Set([doomRoutes.edit.path, doomRoutes.since.path])
  const refuseNetwork = (url) => paths.has(url.pathname)
  const fail = (route) => route.abort("internetdisconnected")
  await page.route(refuseNetwork, fail)
  const first = await insert("column")
  await expect(node(page, first)).toBeAttached()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(node(page, first)).toHaveCount(0)
  const offline = await insert("column")
  await expect(page.locator('[data-save-status="offline"], [data-save-status="unreached"]')).toBeAttached()
  expect((await read()).fold.nodes[offline]).toBeUndefined()
  await page.reload()
  await expect(node(page, offline)).toBeAttached()
  await capture("offline-reload")
  await page.unroute(refuseNetwork, fail)
  await page.evaluate(() => dispatchEvent(new Event("online")))
  await expect.poll(async () => (await read()).fold.nodes[offline]?.instance?.component.id).toBe("column")
  await expect(page.locator('[data-save-status="saved"]')).toBeAttached()
  note(
    "Six chart inserts landed on the canvas and filmstrip. Undo removed an offline insert, and the next insert survived reload and saved after reconnect.",
  )

  expect(column).toBeDefined()
  const target = column.id
  const data = {
    rows: [
      { id: "north", label: "North", value: 42 },
      { id: "south", label: "South", value: 25 },
    ],
  }
  const focused = await call("edit_deck", {
    deck,
    base: (await read()).rev,
    changes: [{ op: "set", target, data, focus: ["north"] }],
  })
  expect(focused.ok).toBe(true)
  expect((await read()).fold.nodes[target].instance).toMatchObject({ data, focus: ["north"] })
  const slide = column.parent.id
  const detail = await call("read_deck", { deck, slide, detail: target })
  expect(detail.ok).toBe(true)
  expect(detail.instance).toBeUndefined()
  await page.locator('[data-slide-entry="2"]').click()
  await expect(node(page, target)).toBeAttached()
  await expect.poll(async () => (await call("read_deck", { deck, slide, picture: true })).pictures).toEqual([slide])
  const detached = await call("edit_deck", {
    deck,
    base: focused.rev,
    runId: focused.runId,
    changes: [{ op: "detach", target }],
  })
  expect(detached.ok).toBe(true)
  expect((await read()).fold.nodes[target].instance).toBeUndefined()
  await call("stop_run", { deck, runId: focused.runId })
  note("MCP updated the data and focus of a saved chart, read its picture, and detached it.")

  const airaDeck = await openDoomDeck(kit)
  const airaRead = () => readDoom(kit, airaDeck)
  const targetForAira = await insert("column")
  await expect.poll(async () => (await airaRead()).fold.nodes[targetForAira]?.instance?.component.id).toBe("column")
  const before = await airaRead()
  aira([
    { name: "update-column.sse", fill: { deck: airaDeck.deck, base: String(before.rev), target: targetForAira } },
    { name: "updated-column.sse" },
  ])
  const held = await holdReply(mcpRoutes.mcp, { afterServer: true })
  const composer = page.getByRole("textbox", { name: airaCopy.askAira })
  await composer.fill("Update this chart with launch and renewal revenue")
  await composer.press("Enter")
  await held.received
  await held.release()
  await expect(page.locator("[data-slide-box]").getByText("Launch", { exact: true })).toBeVisible()
  const after = await airaRead()
  expect(Object.values(after.fold.nodes).filter((node) => node.instance)).toHaveLength(1)
  expect(after.fold.nodes[targetForAira].instance.data.rows).toEqual([
    { id: "launch", label: "Launch", value: 37 },
    { id: "renewal", label: "Renewal", value: 61 },
  ])
  await capture("aira-updated-column")
  note("Aira's recorded turn updated the data on a saved chart.")
}
