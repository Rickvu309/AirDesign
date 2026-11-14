import path from "node:path"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"

export default async function drive({ repo, origin, page, signIn, post, capture, note, deckRoutes }) {
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const { mcpRoutes } = await import(pathToFileURL(path.join(repo, "packages/catalog/dist/index.js")).href)
  const { cookie } = await signIn()
  let id = 0
  async function call(name, args) {
    const response = await fetch(new URL(mcpRoutes.mcp.path, origin), {
      method: "POST",
      headers: { cookie, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
    })
    expect(response.status).toBe(200)
    const text = await response.text()
    const body = text.startsWith("event:")
      ? text
          .split("\n")
          .find((line) => line.startsWith("data: "))
          .slice(6)
      : text
    return JSON.parse(body).result
  }
  async function tool(name, args) {
    const answer = await call(name, args)
    expect(answer.isError).not.toBe(true)
    note(`${name}: ${JSON.stringify(answer.structuredContent).slice(0, 400)}`)
    return answer.structuredContent
  }
  const fixture = path.join(repo, "scripts/pptx-fixtures/shapes-added.pptx")
  const part = "ppt/slides/slide1.xml"
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await capture("imported")

  const stroke = (shape) =>
    page.locator(`[data-slide-paint] [data-canvas-element="${part}#${shape}"]`).evaluate((node) => {
      const drawn = node.querySelector(
        "[data-canvas-line] > rect, [data-canvas-line] > line, [data-canvas-line] > ellipse",
      )
      return {
        color: drawn?.getAttribute("stroke") ?? null,
        width: drawn?.getAttribute("stroke-width") ?? null,
        dash: drawn?.getAttribute("stroke-dasharray") ?? null,
        tail: drawn?.getAttribute("marker-end") ?? null,
      }
    })
  const connectorBefore = await stroke("6")
  let edited
  let node
  await expect
    .poll(
      async () => {
        const read = await tool("airdesign_read_deck", { deck })
        node = read.elements.find((element) => element.kind === "connector").node
        const set = {
          op: "set",
          target: node,
          line: { width: 4, fill: "accent2", dash: "dash", tail: { type: "triangle", width: "lg", length: "lg" } },
        }
        edited = await call("airdesign_edit_deck", { deck, base: read.revision, changes: [set] })
        return edited.isError === true ? JSON.stringify(edited.structuredContent) : "landed"
      },
      { timeout: 60_000, intervals: [1_000] },
    )
    .toBe("landed")
  note(`airdesign_edit_deck set line on ${node}: ${JSON.stringify(edited.structuredContent)}`)
  await tool("airdesign_stop_run", { deck, runId: edited.structuredContent.runId })
  const read = await tool("airdesign_read_deck", { deck })
  const design = read.elements.find((element) => element.node === node).design
  expect(design).toContain("line.width 4 · line.fill accent2 · line.dash dash · line.tail triangle")
  note(`read_deck prints ${node} as: ${design}`)
  await expect.poll(async () => (await stroke("6")).tail).toMatch(/url\(#.+-tail\)/)
  const connectorAfter = await stroke("6")
  expect(connectorAfter.width).not.toBe(connectorBefore.width)
  expect(connectorAfter.dash).not.toBeNull()
  await capture("agent-styled-connector")
  note(`The open editor painted the connector ${JSON.stringify(connectorBefore)} -> ${JSON.stringify(connectorAfter)}`)

  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page.locator(`[data-slide-paint] [data-canvas-element="${part}#4"]`).click({ position: { x: 4, y: 4 } })
  const line = page
    .locator("[data-design-element] section")
    .filter({ has: page.getByRole("heading", { name: "Line", exact: true }) })
  await expect(line).toBeVisible()
  const rectangleBefore = await stroke("4")
  const width = line.getByRole("textbox", { name: "Width", exact: true })
  await width.fill("6")
  await width.press("Enter")
  await line.getByRole("group", { name: "Join", exact: true }).getByRole("button", { name: "Bevel" }).click()
  await expect.poll(async () => (await stroke("4")).width).not.toBe(rectangleBefore.width)
  const rectangleAfter = await stroke("4")
  expect(rectangleAfter.color).toBe(rectangleBefore.color)
  await capture("person-styled-rectangle")
  note(
    `A person's Width 6 pt and Bevel join painted the rectangle ${JSON.stringify(rectangleAfter)}; its style colour stayed`,
  )

  const server = async () => JSON.stringify((await post(deckRoutes.open, { deck }, cookie)).json.register)
  await expect.poll(server).toContain('"join":{"set":"bevel"}')
  note("The server holds the agent's line row and the person's line rows")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "line-style.pptx")
  await (await downloading).saveAs(exported)
  const parts = await pptx.readParts(await readFile(exported))
  const connector = pptx.shownLine(parts, { part, shape: "6" })
  const rectangle = pptx.shownLine(parts, { part, shape: "4" })
  expect(connector.width).toEqual({ value: 50800, own: true })
  expect(connector.tail.value).toEqual({ type: "triangle", width: "lg", length: "lg" })
  expect(rectangle.width).toEqual({ value: 76200, own: true })
  expect(rectangle.join).toEqual({ value: "bevel", own: true })
  expect(rectangle.fill.own).toBe(false)
  const slide = new TextDecoder().decode(parts.get(part))
  note(`The export's lines: ${slide.match(/<a:ln[ >].*?<\/a:ln>/g).join(" ")}`)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", page.url().split("/").at(-1))
  await expect.poll(() => stroke("6")).toEqual(connectorAfter)
  await expect.poll(() => stroke("4")).toEqual(rectangleAfter)
  await capture("reopened")
  note("The exported file opened again with both lines painted as before")
}
