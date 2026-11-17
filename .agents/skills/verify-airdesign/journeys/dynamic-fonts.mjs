import path from "node:path"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { openDeck } from "../look/open-deck.mjs"

export default async function drive(kit) {
  const { page, repo, origin, note, capture } = kit
  const { mcpRoutes } = await import(pathToFileURL(path.join(repo, "packages/catalog/dist/index.js")).href)
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const { cookie } = await kit.signIn()
  const requests = []
  page.on("request", (request) => requests.push(request.url()))
  await page.goto("/")
  await openDeck(page, path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  const deck = page.url().split("/").at(-1)
  let id = 0
  const tool = async (name, args) => {
    const response = await fetch(new URL(mcpRoutes.mcp.path, origin), {
      method: "POST",
      headers: { cookie, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
    })
    const text = await response.text()
    const body = text.startsWith("event:")
      ? text
          .split("\n")
          .find((line) => line.startsWith("data: "))
          .slice(6)
      : text
    const answer = JSON.parse(body).result
    expect(answer.isError).not.toBe(true)
    note(`${name}: ${JSON.stringify(answer.structuredContent).slice(0, 500)}`)
    return answer.structuredContent
  }
  let read
  await expect
    .poll(async () => {
      read = await tool("airdesign_read_deck", { deck })
      return read.index
    })
    .toBe("ready")
  let release = () => {}
  const blocked = new Promise((resolve) => {
    release = resolve
  })
  await page.route("**/fonts/family?family=Montserrat", async (route) => {
    await blocked
    await route.continue()
  })
  const edited = await tool("airdesign_edit_deck", {
    deck,
    base: read.revision,
    changes: [{ op: "set", target: read.elements[0].node, text: { font: "Montserrat" } }],
  })
  await expect(page.locator("[data-slide-paint] [data-fonts-pending]")).toBeAttached()
  await expect(page.locator("[data-slide-paint] [data-paragraph]")).toHaveCount(0)
  release()
  await expect(page.locator("[data-slide-paint] [data-fonts-pending]")).toHaveCount(0)
  const font = await page
    .locator("[data-slide-paint] [data-run]")
    .first()
    .evaluate((node) => ({
      family: getComputedStyle(node).fontFamily,
      faces: [...document.fonts]
        .filter((face) => face.family === "Montserrat")
        .map((face) => ({ weight: face.weight, style: face.style, status: face.status })),
    }))
  expect(font.family).toContain("Montserrat")
  expect(font.faces).toHaveLength(2)
  expect(font.faces.every((face) => face.status === "loaded")).toBe(true)
  expect(requests.filter((url) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([])
  await tool("airdesign_stop_run", { deck, runId: edited.runId })
  await capture("agent-montserrat")
  note(`Measured canvas faces: ${JSON.stringify(font)}; only same-origin font requests`)
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export", exact: true }).click()
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "montserrat.pptx")
  await (await downloading).saveAs(exported)
  const parts = await pptx.readParts(await readFile(exported))
  const xml = new TextDecoder().decode(parts.get("ppt/slides/slide1.xml"))
  expect(xml).toContain('<a:latin typeface="Montserrat"/>')
  note("Measured export XML names Montserrat on the edited text")
  await page.goto("/")
  await openDeck(page, exported)
  await expect(page.locator("[data-slide-paint] [data-fonts-pending]")).toHaveCount(0)
  await expect(page.locator("[data-slide-paint] [data-run]").first()).toHaveCSS("font-family", /Montserrat/)
  await capture("reimported-montserrat")
}
