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
  const fixture = path.join(repo, "scripts/pptx-fixtures/nasa-1d-cnn.pptx")
  const opened = await pptx.readParts(await readFile(fixture))
  const fileSlides = pptx.readSlides(opened)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await capture("imported")

  const set = { op: "set", target: "*.title", opacity: 60 }
  let edited
  await expect
    .poll(
      async () => {
        const read = await tool("airdesign_read_deck", { deck })
        edited = await call("airdesign_edit_deck", { deck, base: read.revision, changes: [set] })
        return edited.isError === true ? JSON.stringify(edited.structuredContent) : "landed"
      },
      { timeout: 60_000, intervals: [1_000] },
    )
    .toBe("landed")
  note(`airdesign_edit_deck ${JSON.stringify(set)}: ${JSON.stringify(edited.structuredContent)}`)
  await tool("airdesign_stop_run", { deck, runId: edited.structuredContent.runId })
  const read = await tool("airdesign_read_deck", { deck })
  const fadedTitles = edited.structuredContent.elements.length
  const titles = read.elements.filter((element) => element.role === "title")
  expect(titles.length).toBeGreaterThan(5)
  for (const title of titles) expect(title.design).toContain("alpha 60")
  note(`set landed on ${fadedTitles} titles; read_deck prints the first as: ${titles[0].design}`)

  const title = titles[0]
  const position = read.slides.find((slide) => slide.id === title.slide).position
  const part = fileSlides.find((slide) => slide.slide === title.slide).part
  const shape = title.node.split(".")[1]
  const entry = (number) => page.locator(`[data-slide-entry="${number}"]`)
  await entry(position + 1).click()
  await expect(entry(position + 1)).toHaveAttribute("aria-current", "true")
  const titleShape = page.locator(`[data-slide-paint] [data-canvas-element="${part}#${shape}"]`)
  const inked = () =>
    titleShape.evaluate((node) => {
      const run = [...node.querySelectorAll("span")].find((span) => span.textContent.trim() !== "")
      return run === undefined ? "" : getComputedStyle(run).color
    })
  await expect.poll(inked).toMatch(/^rgba\(.+, 0\.6\)$/)
  await capture("agent-faded-titles")
  note(`The open editor painted slide ${position + 1}'s title text ${await inked()} before any reload`)

  await page.getByRole("button", { name: "Design", exact: true }).click()
  await titleShape.click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("Escape")
  const section = page
    .locator("[data-design-element] section")
    .filter({ has: page.getByRole("heading", { name: "Opacity", exact: true }) })
  const opacity = section.getByRole("textbox", { name: "Opacity", exact: true })
  await expect(opacity).toHaveValue("60")
  await opacity.fill("30")
  await opacity.press("Enter")
  await expect(opacity).toHaveValue("30")
  await expect.poll(inked).toMatch(/^rgba\(.+, 0\.3\)$/)
  await expect(page.getByRole("button", { name: "Undo opacity", exact: true })).toBeVisible()
  await capture("person-faded-title")
  note(`A person's Opacity 30 painted the title ${await inked()}; Undo reads Undo opacity`)

  const server = async () => JSON.stringify((await post(deckRoutes.open, { deck }, cookie)).json.register)
  await expect.poll(server).toContain('"alpha":{"set":30000}')
  note("The server holds the agent's alpha rows and the person's alpha row")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "opacity.pptx")
  await (await downloading).saveAs(exported)
  const parts = await pptx.readParts(await readFile(exported))
  expect(pptx.shownAlphas(parts, { slide: title.slide, part, shape }).text).toBe(30000)
  const others = titles.slice(1).map((each) => {
    const at = { slide: each.slide, part: fileSlides.find((slide) => slide.slide === each.slide).part }
    return pptx.shownAlphas(parts, { ...at, shape: each.node.split(".")[1] }).text
  })
  expect(others.every((alpha) => alpha === 60000 || alpha === null)).toBe(true)
  note(`The export reads the person's title text at 30000 and the other titles at ${JSON.stringify(others)}`)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", page.url().split("/").at(-1))
  await entry(position + 1).click()
  await expect.poll(inked).toMatch(/^rgba\(.+, 0\.3\)$/)
  await capture("reopened")
  note("The exported file opened again with the title painted at 30 percent")
}
