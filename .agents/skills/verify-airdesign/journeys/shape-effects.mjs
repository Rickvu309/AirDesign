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
  const fixture = path.join(repo, "scripts/pptx-fixtures/corpus/nasa-cots-electronics.pptx")
  const glowing = "ppt/slides/slide7.xml"
  const agents = "ppt/slides/slide9.xml"
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const slide = async (position) => {
    const entry = page.locator(`[data-slide-entry="${position}"]`)
    await entry.click()
    await expect(entry).toHaveAttribute("aria-current", "true")
  }
  const effects = (part) =>
    page.locator(`[data-slide-paint] [data-canvas-element="${part}#4"]`).evaluate((node) => ({
      shadow: node.querySelector("[data-effect-shadow]")?.getAttribute("transform") ?? null,
      glow: node.querySelectorAll("[data-effect-glow]").length,
    }))
  await slide(9)
  const before = await effects(agents)
  await capture("imported")

  let ninth
  await expect
    .poll(
      async () => {
        const answer = await call("airdesign_read_deck", { deck })
        if (answer.isError === true) return JSON.stringify(answer.content)
        ninth = answer.structuredContent.slides?.find((each) => each.position === 8)?.id
        return ninth === undefined ? "slide 9 is not listed yet" : "listed"
      },
      { timeout: 90_000, intervals: [5_000] },
    )
    .toBe("listed")
  const node = `${ninth}.4`
  const slideRead = await tool("airdesign_read_deck", { deck, slide: ninth })
  expect(slideRead.elements.find((element) => element.node === node)?.design).toContain("effects.shadow")
  const set = {
    op: "set",
    target: node,
    effects: {
      shadow: { outer: { blur: 6, distance: 5, direction: 45, color: "#000000 alpha 40" } },
      glow: { halo: { radius: 8, color: "accent2 alpha 60" } },
    },
  }
  const edited = await call("airdesign_edit_deck", { deck, base: slideRead.revision, changes: [set] })
  expect(edited.isError, JSON.stringify(edited.content)).not.toBe(true)
  note(`airdesign_edit_deck set effects on ${node}: ${JSON.stringify(edited.structuredContent)}`)
  await tool("airdesign_stop_run", { deck, runId: edited.structuredContent.runId })
  const read = await tool("airdesign_read_deck", { deck, slide: ninth })
  const design = read.elements.find((element) => element.node === node).design
  expect(design).toContain("effects.shadow blur 6 distance 5 direction 45 #000000 alpha 40")
  expect(design).toContain("effects.glow radius 8 accent2 alpha 60")
  note(`read_deck prints ${node} as: ${design}`)
  await slide(9)
  await expect.poll(async () => (await effects(agents)).glow).toBe(1)
  const after = await effects(agents)
  await capture("agent-effects")
  note(`The open editor painted the agent's effects ${JSON.stringify(before)} -> ${JSON.stringify(after)}`)

  await slide(7)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page.locator(`[data-slide-paint] [data-canvas-element="${glowing}#4"]`).click({ position: { x: 4, y: 4 } })
  await expect(page.locator("[data-design-element]")).toBeVisible()
  await unfold(page.locator("[data-design-element]"), "Effects")
  const section = page
    .locator("[data-design-element] section")
    .filter({ has: page.getByRole("heading", { name: "Effects", exact: true }) })
  await expect(section).toBeVisible()
  await section.getByRole("group", { name: "Glow", exact: true }).getByRole("button", { name: "Glow" }).click()
  await expect.poll(async () => (await effects(glowing)).glow).toBe(1)
  await section.getByRole("heading", { name: "Effects", exact: true }).scrollIntoViewIfNeeded()
  await capture("person-glow")
  note("A person's Glow painted around the rectangle whose shadow comes from its style")

  const server = async () => JSON.stringify((await post(deckRoutes.open, { deck }, cookie)).json.register)
  await expect.poll(server).toContain('"glow":{"set":{"halo"')
  note("The server holds the agent's effects row and the person's effects row")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "shape-effects.pptx")
  await (await downloading).saveAs(exported)
  const parts = await pptx.readParts(await readFile(exported))
  const person = pptx.shownEffects(parts, { part: glowing, shape: "4" })
  const agent = pptx.shownEffects(parts, { part: agents, shape: "4" })
  expect(person.glow.value.halo.radius).toBe(63500)
  expect(person.shadow.value.outer).toEqual({
    blur: 40000,
    distance: 23000,
    direction: 5400000,
    color: { rgb: "000000", transforms: [{ op: "alpha", val: 35000 }] },
  })
  expect(agent.shadow.value.outer.distance).toBe(63500)
  expect(agent.glow.value.halo.radius).toBe(101600)
  for (const part of [glowing, agents]) {
    const list = new TextDecoder().decode(parts.get(part)).match(/<a:effectLst>.*?<\/a:effectLst>/s)?.[0]
    note(`The export's effects on ${part}: ${list}`)
  }

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", page.url().split("/").at(-1))
  await slide(7)
  await expect.poll(async () => (await effects(glowing)).glow).toBe(1)
  await capture("reopened")
  note("The exported file opened again with the person's glow and the copied style shadow painted")
}
