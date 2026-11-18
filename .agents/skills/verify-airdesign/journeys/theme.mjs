import { templateCopy, productCopy } from "../bin/product-copy.mjs"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { colorCopy } from "../bin/product-copy.mjs"

const themes = ["ppt/theme/theme1.xml", "ppt/theme/theme2.xml"]

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
  const fixture = path.join(repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx")
  const original = await pptx.readParts(await readFile(fixture))
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await capture("imported")

  const entry = (number) => page.locator(`[data-slide-entry="${number}"]`)
  const painted = (key) => page.locator(`[data-slide-paint] [data-canvas-element="${key}"]`)
  const fonts = (locator) =>
    locator.evaluate((node) => [...node.querySelectorAll("*")].map((each) => each.style.fontFamily).join(" | "))
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await entry(8).click()
  await page.getByRole("button", { name: templateCopy.editTemplateStyle, exact: true }).click()
  const theme = page.locator("[data-template-style-dialog]")
  await expect(theme).toBeVisible()
  await capture("theme-panel")

  const oval = painted("ppt/slides/slide8.xml#7")
  const ovalBefore = await oval.innerHTML()
  await theme.getByRole("button", { name: "Accent 1", exact: true }).click()
  const picker = page.locator("[data-color-picker]")
  await picker.getByRole("button", { name: colorCopy.add, exact: true }).click()
  const hex = picker.getByRole("textbox", { name: colorCopy.hex, exact: true })
  await hex.fill("#c00000")
  await hex.press("Enter")
  await page.keyboard.press("Escape")
  await expect.poll(() => oval.innerHTML()).not.toBe(ovalBefore)
  await capture("person-accent-1")
  note("A person's Accent 1 #C00000 repainted slide 8's oval, whose line names accent1 through its style")

  await theme.getByRole("button", { name: productCopy.close, exact: true }).click()
  await entry(1).click()
  await page.getByRole("button", { name: templateCopy.editTemplateStyle, exact: true }).click()
  const title = painted("ppt/slides/slide1.xml#2")
  const heading = theme.getByRole("textbox", { name: "Heading font", exact: true })
  await heading.fill("Georgia")
  await heading.press("Enter")
  await expect.poll(() => fonts(title)).toContain("Georgia")
  await capture("person-heading-font")
  note("A person's Heading font Georgia repainted slide 1's title before any reload")

  const server = async () => (await post(deckRoutes.open, { deck }, cookie)).json.register
  await expect
    .poll(async () => JSON.stringify((await server()).elements["deck.templateStyle1"]?.landed ?? []))
    .toContain('"major":{"set":"Georgia"}')
  note("The server holds the person's heading font on deck.templateStyle1")

  const set = {
    op: "set",
    target: "deck.theme",
    theme: { accent1: "#C00000", major: "Georgia", accent2: "#00B050", minor: "Verdana" },
  }
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
  expect(read.templateStyles).toHaveLength(2)
  for (const template of read.templateStyles)
    expect(template.palette.slots).toMatchObject({ accent1: "C00000", accent2: "00B050" })
  for (const palette of read.palettes) expect(palette.slots).toMatchObject({ accent1: "C00000", accent2: "00B050" })
  note(`read_deck prints two scoped templates and accent1 C00000, accent2 00B050 in every palette`)
  for (const palette of read.palettes) expect(palette.fonts).toEqual({ major: "Georgia", minor: "Verdana" })
  const bodyFont = read.elements.find((element) => element.node === "256.4")
  expect(bodyFont?.design).toContain("text.font Verdana (master)")
  note(`read_deck names the theme's body font as it is now in 256.4's design line: ${bodyFont?.design}`)
  const subtitle = painted("ppt/slides/slide1.xml#3")
  await expect.poll(() => fonts(subtitle)).toContain("Verdana")
  await expect(theme.getByRole("textbox", { name: "Body font", exact: true })).toHaveValue("Verdana")
  await capture("agent-theme")
  note("The open editor painted the agent's body font Verdana on slide 1's subtitle and showed it in the panel")

  await page.reload()
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await entry(1).click()
  await page.getByRole("button", { name: templateCopy.editTemplateStyle, exact: true }).click()
  await expect(theme.getByRole("textbox", { name: "Heading font", exact: true })).toHaveValue("Georgia")
  await expect.poll(() => fonts(painted("ppt/slides/slide1.xml#2"))).toContain("Georgia")
  await capture("reloaded")
  note("A reload kept Accent 1's heading font Georgia on slide 1")

  await theme.getByRole("button", { name: productCopy.close, exact: true }).click()
  const downloading = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const out = path.dirname(await capture("exported"))
  const exported = path.join(out, "theme.pptx")
  await (await downloading).saveAs(exported)
  const parts = await pptx.readParts(await readFile(exported))
  const changed = [...original.keys()].filter((name) => {
    const before = original.get(name)
    const after = parts.get(name)
    return after === undefined || before.length !== after.length || before.some((byte, at) => byte !== after[at])
  })
  expect(changed.sort()).toEqual(themes)
  for (const part of themes) {
    const xml = new TextDecoder().decode(parts.get(part))
    for (const [kind, font] of [
      ["major", "Georgia"],
      ["minor", "Verdana"],
    ]) {
      const latin = new RegExp(`<a:${kind}Font>(<a:latin[^>]*>)`).exec(
        new TextDecoder().decode(original.get(part)),
      )?.[1]
      expect(latin).toBeDefined()
      expect(xml).toContain(latin.replace(/typeface="[^"]*"/, `typeface="${font}"`))
    }
    for (const written of [
      '<a:accent1><a:srgbClr val="C00000"/></a:accent1>',
      '<a:accent2><a:srgbClr val="00B050"/></a:accent2>',
      '<a:majorFont><a:latin typeface="Georgia"',
      '<a:minorFont><a:latin typeface="Verdana"',
    ])
      expect(xml).toContain(written)
  }
  note(
    `The export ${path.basename(exported)} changed only ${themes.join(" and ")}, each with both colours and both fonts`,
  )

  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(exported)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", page.url().split("/").at(-1))
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page.getByRole("button", { name: templateCopy.editTemplateStyle, exact: true }).click()
  await expect(theme.getByRole("button", { name: "Accent 1", exact: true })).toHaveAttribute("title", /#C00000/)
  await expect(theme.getByRole("textbox", { name: "Heading font", exact: true })).toHaveValue("Georgia")
  await expect.poll(() => fonts(painted("ppt/slides/slide1.xml#2"))).toContain("Georgia")
  await capture("reopened")
  note("The exported file opened again with Accent 1 #C00000 and Georgia titles")
}
