import { openDeck } from "../look/open-deck.mjs"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

export default async function drive(kit) {
  const { page, repo, expect, capture, post, deckRoutes, note } = kit
  const require = createRequire(import.meta.url)
  const { textCopy } = require(path.join(repo, "apps/web/src/copy/text-copy.ts"))
  const { placeholderRoles } = require(path.join(repo, "apps/web/src/copy/placeholder-copy.ts"))
  const { formatCopy } = require(path.join(repo, "apps/web/src/copy/format-copy.ts"))
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const document = await import(pathToFileURL(path.join(repo, "packages/document/dist/index.js")).href)
  const fonts = await import(pathToFileURL(path.join(repo, "packages/fonts/dist/index.js")).href)
  const light = fonts.portableFace("Lato Light").name
  const signed = await kit.signIn()
  const fixture = path.join(repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx")
  await page.goto("/")
  await openDeck(page, fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const canvas = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  await canvas.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  const node = await panel.getAttribute("data-design-element")
  const textStyle = panel.getByRole("combobox", { name: textCopy.style, exact: true })
  await textStyle.click()
  await page.getByRole("option", { name: `${placeholderRoles.ctrTitle} · 44`, exact: true }).click()
  await expect(textStyle).toContainText(placeholderRoles.ctrTitle)
  await expect(panel.getByRole("textbox", { name: formatCopy.sizeGroup, exact: true })).toHaveValue("44")
  await expect(panel.getByRole("textbox", { name: textCopy.font, exact: true })).toHaveValue("Calibri Light")
  await expect(canvas.locator("[data-run]").first()).toHaveCSS("font-family", /Calibri Light/)
  await capture("applied-title")
  await page
    .getByRole("button", { name: /^Undo / })
    .first()
    .click()
  await expect(panel.getByRole("textbox", { name: formatCopy.sizeGroup, exact: true })).toHaveValue("36")
  await textStyle.click()
  await page.getByRole("option", { name: `${placeholderRoles.ctrTitle} · 44`, exact: true }).click()
  const font = panel.getByRole("textbox", { name: textCopy.font, exact: true })
  await font.fill("Lato")
  await font.press("Enter")
  const weight = panel.getByRole("combobox", { name: textCopy.weight, exact: true })
  await weight.click()
  await page.getByRole("option", { name: light, exact: true }).click()
  await expect(font).toHaveValue("Lato")
  await expect(weight).toContainText(light)
  await expect(panel.getByRole("button", { name: formatCopy.named.bold, exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  )
  await panel.getByRole("button", { name: formatCopy.named.bold, exact: true }).click()
  await expect(weight).toContainText(formatCopy.named.bold)
  await weight.click()
  await page.getByRole("option", { name: light, exact: true }).click()
  await panel.getByRole("button", { name: textCopy.sizes, exact: true }).click()
  await page.getByRole("menuitem", { name: "48", exact: true }).click()
  await expect(panel.getByRole("textbox", { name: formatCopy.sizeGroup, exact: true })).toHaveValue("48")
  const sizeLabel = panel.getByText(textCopy.size, { exact: true })
  const labelBox = await sizeLabel.boundingBox()
  expect(labelBox).not.toBeNull()
  await page.mouse.move(labelBox.x + 8, labelBox.y + labelBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(labelBox.x + 10, labelBox.y + labelBox.height / 2)
  await page.mouse.up()
  await expect(panel.getByRole("textbox", { name: formatCopy.sizeGroup, exact: true })).toHaveValue("49")
  await page
    .getByRole("button", { name: /^Undo / })
    .first()
    .click()
  await expect(panel.getByRole("textbox", { name: formatCopy.sizeGroup, exact: true })).toHaveValue("48")
  await expect(textStyle).toContainText(textCopy.custom)
  const serverValue = async () => {
    const server = (await post(deckRoutes.open, { deck }, signed.cookie)).json.register
    return document.currentValue(server.elements[node])
  }
  await expect.poll(serverValue).toContain('"font":"Lato Light"')
  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await canvas.click({ position: { x: 4, y: 4 } })
  await expect(weight).toContainText(light)
  const file = path.join(path.dirname(await capture("reloaded")), "text-style-weight.pptx")
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export", exact: true }).click()
  await (await downloading).saveAs(file)
  const parts = await pptx.readParts(await readFile(file))
  const original = await pptx.readParts(await readFile(fixture))
  const xml = new TextDecoder().decode(parts.get("ppt/slides/slide1.xml"))
  expect(xml).toContain('typeface="Lato Light"')
  expect(xml).toContain('sz="4800"')
  expect(xml).toContain('b="0"')
  const changed = [...original]
    .filter(([name, before]) => !Buffer.from(parts.get(name) ?? []).equals(Buffer.from(before)))
    .map(([name]) => name)
  expect(changed).toEqual(["ppt/slides/slide1.xml"])
  const { mcpRoutes } = await import(pathToFileURL(path.join(repo, "packages/catalog/dist/index.js")).href)
  let requestId = 0
  async function tool(name, args) {
    const response = await fetch(new URL(mcpRoutes.mcp.path, kit.origin), {
      method: "POST",
      headers: {
        cookie: signed.cookie,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++requestId,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    })
    expect(response.status).toBe(200)
    const text = await response.text()
    const body = text.startsWith("event:")
      ? text
          .split("\n")
          .find((line) => line.startsWith("data: "))
          .slice(6)
      : text
    const result = JSON.parse(body).result
    expect(result.isError).not.toBe(true)
    return result.structuredContent
  }
  const read = await tool("airdesign_read_deck", { deck })
  const slideId = read.slides[0].id
  const scoped = await tool("airdesign_read_deck", { deck, slide: slideId })
  const title = scoped.slides
    .find((slide) => slide.id === slideId)
    ?.textStyles?.find((style) => style.name === placeholderRoles.ctrTitle)
  expect(title).toBeDefined()
  const edited = await tool("airdesign_edit_deck", {
    deck,
    base: read.revision,
    changes: [{ op: "set", target: node, text: { style: title.id } }],
  })
  expect(edited.ok).toBe(true)
  const stopped = await tool("airdesign_stop_run", { deck, runId: edited.runId })
  expect(stopped.ok).toBe(true)
  await expect(canvas.locator("[data-run]").first()).toHaveCSS("font-family", /Calibri Light/)
  await canvas.click({ position: { x: 4, y: 4 } })
  await expect(textStyle).toContainText(placeholderRoles.ctrTitle)
  await capture("agent-applied-title")
  note(
    `MCP read_deck exposes template text styles; edit_deck text.style ${title.id} lands and paints the matching style.`,
  )
  note(
    `Style, one-step Undo, Weight/Bold agreement, portable face, preset size, Custom, server, reload and native export passed. Only slide1.xml changed: ${file}`,
  )
}
