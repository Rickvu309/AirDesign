import { pictureCopy } from "../bin/product-copy.mjs"
import { unfold } from "../look/unfold.mjs"
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
    expect(answer.isError, JSON.stringify(answer.content)).not.toBe(true)
    note(`${name}: ${JSON.stringify(answer.structuredContent).slice(0, 400)}`)
    return answer.structuredContent
  }
  const slidePart = "ppt/slides/slide1.xml"
  const canvas = (shape) => page.locator(`[data-slide-paint] [data-canvas-element="${slidePart}#${shape}"]`)
  const look = (shape) =>
    canvas(shape).evaluate((node) => {
      const style = getComputedStyle(node.querySelector("[data-fill-image]") ?? node)
      return {
        image: style.backgroundImage,
        size: style.backgroundSize,
        filter: style.filter,
        label: node.getAttribute("aria-label"),
      }
    })
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/picture-png.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await capture("imported")

  let slide
  await expect
    .poll(
      async () => {
        const answer = await call("airdesign_read_deck", { deck })
        if (answer.isError === true) return JSON.stringify(answer.content)
        slide = answer.structuredContent.slides?.[0]?.id
        return answer.structuredContent.index === "ready" && slide !== undefined ? "ready" : "indexing"
      },
      { timeout: 90_000, intervals: [3_000] },
    )
    .toBe("ready")
  const before = await tool("airdesign_read_deck", { deck })
  const wrong = await call("airdesign_edit_deck", {
    deck,
    base: before.revision,
    changes: [{ op: "add", kind: "picture", slide, icon: "rockets" }],
  })
  expect(wrong.isError).toBe(true)
  const refusal = wrong.content.map((block) => block.text).join(" ")
  expect(refusal).toContain('No Lucide icon is named "rockets". Close names: rocket')
  note(`A wrong icon name is refused with close names: ${refusal.slice(0, 300)}`)
  const added = await tool("airdesign_edit_deck", {
    deck,
    base: before.revision,
    changes: [{ op: "add", kind: "shape", slide, icon: "rocket" }],
  })
  const node = added.elements.find((element) => element.node.startsWith(`${slide}.`))?.node
  expect(node).toBeDefined()
  const shape = node.split(".")[1]
  await tool("airdesign_edit_deck", {
    deck,
    base: added.revision,
    changes: [{ op: "set", target: node, identity: { alt: "A rocket lifting off" } }],
  })
  await tool("airdesign_stop_run", { deck, runId: added.runId })
  const read = await tool("airdesign_read_deck", { deck })
  const design = read.elements.find((element) => element.node === node)?.design
  expect(design).toBe("fills image · fills.source rocket · identity.alt A rocket lifting off")
  note(`read_deck prints ${node} as: ${design}`)
  await expect.poll(async () => (await look(shape)).image).toContain("data:image/svg+xml")
  await expect.poll(async () => (await look(shape)).label).toBe("A rocket lifting off")
  await capture("agent-icon")
  note("The open editor painted the agent's rocket icon as a vector, named by its alt text, before any reload")

  const photo = await look("4")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await canvas("4").click({ position: { x: 8, y: 8 } })
  const panel = page.locator("[data-design-element]")
  const section = (name) => panel.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) })
  await unfold(panel, pictureCopy.crop)
  await unfold(panel, pictureCopy.section)
  const crop = section(pictureCopy.crop)
  for (const [side, value] of [
    ["Left", "10"],
    ["Right", "10"],
  ]) {
    const input = crop.getByRole("textbox", { name: side, exact: true })
    await input.fill(value)
    await input.press("Enter")
  }
  await expect.poll(async () => (await look("4")).size).not.toBe(photo.size)
  await section(pictureCopy.section)
    .getByRole("group", { name: "Recolor", exact: true })
    .getByRole("button", { name: "Grayscale" })
    .click()
  await expect.poll(async () => (await look("4")).filter).toBe("grayscale(1)")
  await section(pictureCopy.section)
    .getByRole("heading", { name: pictureCopy.section, exact: true })
    .scrollIntoViewIfNeeded()
  await capture("person-crop-recolor")
  note(
    `A person cropped 10 % from each side and chose Grayscale: ${JSON.stringify(photo)} -> ${JSON.stringify(await look("4"))}`,
  )

  await page.getByRole("button", { name: "Add icon", exact: true }).click()
  await page.locator("[data-icon-tool]").getByRole("searchbox", { name: "Search icons" }).fill("leaf")
  await page.locator("[data-icon-tool]").getByRole("button", { name: "leaf", exact: true }).click()
  await expect(page.getByRole("button", { name: "Undo add icon", exact: true })).toBeVisible()
  await capture("person-icon")
  note("A person added the leaf icon from the toolbar")

  const server = async () => JSON.stringify((await post(deckRoutes.open, { deck }, cookie)).json.register)
  await expect.poll(server).toContain('"grayscale":true')
  await expect.poll(server).toContain('"source":{"set":"leaf"}')
  note("The server holds the agent's icon and alt text, the person's crop and recolor rows, and the person's icon")

  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "picture-icon.pptx")
  await (await downloading).saveAs(exported)
  const parts = await pptx.readParts(await readFile(exported))
  const at = (each) => ({ slide, part: slidePart, shape: each })
  expect(pptx.shownImage(parts, at(shape))?.source).toBe("rocket")
  expect(pptx.shownIdentity(parts, at(shape))?.alt).toBe("A rocket lifting off")
  expect(pptx.shownImage(parts, at("4"))?.recolor).toEqual({ grayscale: true })
  expect(pptx.shownCrop(parts, at("4"))).toEqual({ l: 10000, t: 0, r: 10000, b: 0 })
  for (const name of ["rocket", "leaf"]) {
    const svg = new TextDecoder().decode(parts.get(`ppt/media/icon-${name}.svg`) ?? new Uint8Array())
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(parts.get(`ppt/media/icon-${name}.png`)?.byteLength ?? 0).toBeGreaterThan(100)
  }
  const blips = new TextDecoder().decode(parts.get(slidePart)).match(/<p:blipFill>.*?<\/p:blipFill>/gs)
  note(`The export's blips: ${JSON.stringify(blips)}`)

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", page.url().split("/").at(-1))
  await expect.poll(async () => (await look(shape)).image).toContain("data:image/svg+xml")
  await expect.poll(async () => (await look("4")).filter).toBe("grayscale(1)")
  await capture("reopened")
  note("The exported file opened again with both icons painted and the photo cropped and gray")
}
