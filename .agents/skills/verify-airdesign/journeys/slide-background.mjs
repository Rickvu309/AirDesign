import path from "node:path"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"

const white = "rgb(255, 255, 255)"
const agentColor = "rgb(31, 78, 121)"

export default async function drive({ repo, origin, page, signIn, post, capture, note, deckRoutes }) {
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const { mcpRoutes } = await import(pathToFileURL(path.join(repo, "packages/catalog/dist/index.js")).href)
  const { cookie } = await signIn()
  let id = 0
  async function tool(name, args) {
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
    const answer = JSON.parse(body).result
    expect(answer.isError).not.toBe(true)
    note(`${name}: ${JSON.stringify(answer.structuredContent)}`)
    return answer.structuredContent
  }
  const shown = (selector) => page.locator(selector).evaluate((node) => getComputedStyle(node).backgroundColor)
  const painted = async (color) => {
    await expect.poll(() => shown("[data-slide-paint]")).toBe(color)
    await expect.poll(() => shown("[data-slide-entry='1'] [data-thumb-paint]")).toBe(color)
  }
  await page.goto("/")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByRole("group", { name: "New deck" }).getByRole("button", { name: "Blank deck", exact: true }).click()
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await painted(white)
  const design = page.getByRole("button", { name: "Design", exact: true })
  if ((await page.getByRole("button", { name: "Design, not available yet" }).count()) > 0) {
    await capture("design-panel")
    await capture("background-set")
    note("This build has no Design panel. The Design tab is off and the slide keeps a white background.")
    return
  }
  await design.click()
  const panel = page.locator("[data-design-panel]")
  const colors = panel.getByRole("group", { name: "Colors" })
  await expect(panel.getByText("Slide 1", { exact: true })).toBeVisible()
  await expect(colors.getByRole("button")).toHaveCount(10)
  await capture("design-panel")
  const accent = colors.getByRole("button", { name: "Accent 1", exact: true })
  const chip = await accent
    .locator("span")
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor)
  await accent.click()
  await painted(chip)
  await expect(accent).toHaveAttribute("aria-pressed", "true")
  await capture("background-set")
  const order = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register.order
  await expect
    .poll(async () => (await order()).filter((row) => row.slide === "background").map((row) => row.color))
    .toEqual([{ scheme: "accent1" }])
  note(`Accent 1 painted the canvas and the thumbnail ${chip}, and the server's order holds one background row`)
  await page.getByRole("button", { name: "Undo background color", exact: true }).click()
  await painted(white)
  await capture("background-undone")
  await page.getByRole("button", { name: "Redo background color", exact: true }).click()
  await painted(chip)
  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await painted(chip)
  note("Undo painted white again, Redo brought Accent 1 back, and a reload kept it")
  const read = await tool("airdesign_read_deck", { deck })
  const slide = read.slides[0].id
  const set = await tool("airdesign_set_background", {
    deck,
    base: read.revision,
    slide,
    color: { rgb: "1F4E79" },
  })
  await tool("airdesign_stop_run", { deck, runId: set.runId })
  await painted(agentColor)
  await capture("agent-background")
  note(`An agent's airdesign_set_background on slide ${slide} painted the open editor ${agentColor}`)
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "slide-background.pptx")
  await (await downloading).saveAs(exported)
  const { readFile } = await import("node:fs/promises")
  const parts = await pptx.readParts(await readFile(exported))
  const [first] = pptx.readSlides(parts)
  expect(pptx.paintReader(parts).slide(first.part).background).toEqual({
    type: "solid",
    color: { hex: "1F4E79", alpha: 1 },
  })
  note(`The export ${path.basename(exported)} reads back a solid 1F4E79 background on ${first.part}`)
}
