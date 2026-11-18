import { unfold } from "../look/unfold.mjs"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"

const duplicate = process.platform === "darwin" ? "Meta+d" : "Control+d"

export default async function drive({ repo, origin, page, signIn, post, capture, note, deckRoutes }) {
  const pptx = await import(pathToFileURL(path.join(repo, "packages/pptx/dist/index.js")).href)
  const { mcpRoutes } = await import(pathToFileURL(path.join(repo, "packages/catalog/dist/index.js")).href)
  const { fillCopy, fillWords } = await import(pathToFileURL(path.join(repo, "apps/web/src/copy/fill-copy.ts")).href)
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

  const set = { op: "set", target: "*.title", fills: { paint: "accent2" } }
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
  const filledTitles = edited.structuredContent.elements.length
  const titles = read.elements.filter((element) => element.role === "title")
  expect(titles.length).toBeGreaterThan(5)
  for (const title of titles) expect(title.design).toContain("fills accent2")
  note(`set landed on ${filledTitles} titles; read_deck's first page prints fills accent2 on its ${titles.length}`)
  const firstTitle = titles[0]
  const position = read.slides.find((slide) => slide.id === firstTitle.slide).position
  const firstPart = fileSlides.find((slide) => slide.slide === firstTitle.slide).part
  const accent = pptx.themeSwatches(opened, firstPart).find((swatch) => swatch.scheme === "accent2").css
  const entry = (number) => page.locator(`[data-slide-entry="${number}"]`)
  await entry(position + 1).click()
  await expect(entry(position + 1)).toHaveAttribute("aria-current", "true")
  const titleShape = page.locator(
    `[data-slide-paint] [data-canvas-element="${firstPart}#${firstTitle.node.split(".")[1]}"]`,
  )
  const fill = (locator) =>
    locator.evaluate((node) => {
      const style = getComputedStyle(node)
      return style.backgroundImage !== "none" ? style.backgroundImage : style.backgroundColor
    })
  const hex = (css) => `rgb(${[1, 3, 5].map((at) => Number.parseInt(css.slice(at, at + 2), 16)).join(", ")})`
  await expect.poll(() => fill(titleShape)).toBe(hex(accent))
  await capture("agent-filled-titles")
  note(`The open editor painted slide ${position + 1}'s title ${hex(accent)} (accent2) before any reload`)

  const subtitle = read.elements.find(
    (element) => element.slide === firstTitle.slide && element.kind === "shape" && element.role !== "title",
  )
  const subtitleShape = page.locator(
    `[data-slide-paint] [data-canvas-element="${firstPart}#${subtitle.node.split(".")[1]}"]`,
  )
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await subtitleShape.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  await unfold(panel, fillCopy.box)
  const boxFill = panel
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: fillCopy.box, exact: true }) })
  const kinds = boxFill.getByRole("group", { name: fillCopy.box, exact: true })
  await expect(kinds).toBeVisible()
  await kinds.getByRole("button", { name: fillWords.gradient, exact: true }).click()
  await expect.poll(() => fill(subtitleShape)).toContain("gradient")
  await capture("person-gradient")
  const gradient = await fill(subtitleShape)
  note(`A person's Gradient painted ${subtitle.node} ${gradient}`)

  await page.keyboard.press("Escape")
  await entry(position + 1).focus()
  await page.keyboard.press(duplicate)
  await expect(entry(position + 2)).toHaveAttribute("aria-current", "true")
  const copied = (shape) => page.locator(`[data-slide-paint] [data-canvas-element$="#${shape}"]`)
  await expect.poll(() => fill(copied(firstTitle.node.split(".")[1]))).toBe(hex(accent))
  await expect.poll(() => fill(copied(subtitle.node.split(".")[1]))).toBe(gradient)
  await capture("duplicated")
  note(`The duplicate of slide ${position + 1} kept the agent's accent2 title and the person's gradient`)

  const server = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register
  await expect.poll(async () => JSON.stringify(await server())).toContain('"gradient"')
  const accentRow = /"fills":\{"p0":\{"set":\{"solid":\{"scheme":"accent2"\}/g
  const register = await server()
  const floors = JSON.stringify(register.order.filter((command) => command.slide === "clone"))
  const nodes = JSON.stringify(register.elements)
  expect([(nodes.match(accentRow) ?? []).length, (floors.match(accentRow) ?? []).length]).toEqual([filledTitles, 1])
  note(
    `The server holds ${filledTitles} accent2 title rows, the person's gradient row, and the duplicate's floor carries the copied accent2 as its opening`,
  )

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "shape-fill.pptx")
  await (await downloading).saveAs(exported)
  const parts = await pptx.readParts(await readFile(exported))
  const slides = pptx.readSlides(parts)
  expect(slides.length).toBe(read.slides.length + 1)
  const reader = pptx.paintReader(parts)
  let painted = 0
  for (const { part } of slides) {
    for (const element of reader.slide(part).elements) {
      if (element.from !== "slide") continue
      const shown = pptx.shownFill(parts, { part, shape: element.shape })
      if (shown?.value?.solid?.scheme !== "accent2") continue
      expect(element.fill).toMatchObject({ type: "solid" })
      painted += 1
    }
  }
  expect(painted).toBe(filledTitles + 1)
  note(`The export ${path.basename(exported)} holds accent2 on ${painted} titles, the duplicate's included`)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", page.url().split("/").at(-1))
  await entry(position + 1).click()
  await expect.poll(() => fill(titleShape)).toBe(hex(accent))
  await capture("reopened")
  note("The exported file opened again with the accent2 title painted")
}
