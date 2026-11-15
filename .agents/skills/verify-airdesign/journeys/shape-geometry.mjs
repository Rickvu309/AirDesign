import path from "node:path"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { unfold } from "../look/unfold.mjs"

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
  const presentation = new TextDecoder().decode(opened.get("ppt/presentation.xml"))
  const width = Number(/<p:sldSz cx="(\d+)"/.exec(presentation)[1])
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await capture("imported")

  const set = { op: "set", target: "*.title", box: { align: "right" } }
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
  note(`airdesign_edit_deck ${JSON.stringify(set)}: ${JSON.stringify(edited.structuredContent).slice(0, 400)}`)
  await tool("airdesign_stop_run", { deck, runId: edited.structuredContent.runId })
  const read = await tool("airdesign_read_deck", { deck })
  const titles = read.elements.filter((element) => element.role === "title")
  expect(titles.length).toBeGreaterThan(5)
  for (const title of titles) expect(title.box.x + title.box.cx).toBe(width)
  note(
    `align right landed on ${edited.structuredContent.elements.length} titles; each title's right edge is at ${width} EMU, the slide's width`,
  )

  const firstTitle = titles[0]
  const position = read.slides.find((slide) => slide.id === firstTitle.slide).position
  const firstPart = fileSlides.find((slide) => slide.slide === firstTitle.slide).part
  const entry = (number) => page.locator(`[data-slide-entry="${number}"]`)
  await entry(position + 1).click()
  await expect(entry(position + 1)).toHaveAttribute("aria-current", "true")
  const titleShape = page.locator(
    `[data-slide-paint] [data-canvas-element="${firstPart}#${firstTitle.node.split(".")[1]}"]`,
  )
  const canvas = page.locator("[data-slide-paint]").first()
  const rightGap = async () => {
    const [frame, shape] = await Promise.all([canvas.boundingBox(), titleShape.boundingBox()])
    return Math.round(frame.x + frame.width - (shape.x + shape.width))
  }
  await expect.poll(rightGap).toBeLessThanOrEqual(1)
  await capture("agent-aligned-titles")
  note(`The open editor painted slide ${position + 1}'s title against the slide's right edge before any reload`)

  const other = read.elements.find(
    (element) => element.slide === firstTitle.slide && element.kind === "shape" && element.role !== "title",
  )
  const otherShape = page.locator(`[data-slide-paint] [data-canvas-element="${firstPart}#${other.node.split(".")[1]}"]`)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await otherShape.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  await unfold(panel, "Shape type")
  const rotation = panel.getByRole("textbox", { name: "Rotation", exact: true })
  await rotation.fill("30")
  await rotation.press("Enter")
  await panel.getByRole("button", { name: "Flip vertically", exact: true }).click()
  await panel.getByRole("combobox", { name: "Type", exact: true }).click()
  await page.getByRole("option", { name: "Right arrow", exact: true }).click()
  const head = panel.getByRole("textbox", { name: "Adjust 2", exact: true })
  await head.fill("20000")
  await head.press("Enter")
  const turned = (locator) => locator.evaluate((node) => node.style.transform)
  await expect.poll(() => turned(otherShape)).toBe("rotate(30deg) scale(1, -1)")
  await capture("person-turned-arrow")
  note(`A person turned ${other.node} 30°, flipped it vertically and made it a right arrow with a short head`)

  const server = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register
  await expect.poll(async () => JSON.stringify(await server())).toContain('"rightArrow"')
  note("The server holds the person's rows for the turn, the flip and the right arrow")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "shape-geometry.pptx")
  await (await downloading).saveAs(exported)
  const parts = await pptx.readParts(await readFile(exported))
  const at = { slide: firstTitle.slide, part: firstPart, shape: other.node.split(".")[1] }
  expect(pptx.shownTurn(parts, at)).toEqual({ rot: 1_800_000, flipH: false, flipV: true })
  expect(pptx.shownGeometry(parts, at)?.value).toEqual({ preset: "rightArrow", adjust: { adj2: 20_000 } })
  const painted = pptx
    .paintReader(parts)
    .slide(firstPart)
    .elements.find((element) => element.shape === at.shape)
  expect(painted.box).toMatchObject({ rotation: 30, flipV: true })
  note(`The export ${path.basename(exported)} holds rot 1800000, flipV and rightArrow with adj2 20000 on ${other.node}`)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", page.url().split("/").at(-1))
  await entry(position + 1).click()
  await expect.poll(() => turned(otherShape)).toBe("rotate(30deg) scale(1, -1)")
  await expect.poll(rightGap).toBeLessThanOrEqual(1)
  await capture("reopened")
  note("The exported file opened again with the titles on the right and the turned arrow")
}
