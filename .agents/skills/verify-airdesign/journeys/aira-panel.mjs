import path from "node:path"
import { expect } from "@playwright/test"
import { airaCopy, airaStepWords, undoCopy } from "../bin/product-copy.mjs"

const asked = "Add three KPIs to this slide"

async function doomAgent(kit, cookie) {
  const { page, post, capture, note, doomRoutes, mcpRoutes, aira, holdReply } = kit
  await page.goto("/s")
  await page.locator("[data-doom-ready]").waitFor()
  const deck = new URL(page.url()).pathname.slice("/s/".length)
  const opened = (await post(doomRoutes.open, { deck }, cookie)).json
  const slide = Object.values(opened.fold.nodes).find((node) => node.type === "slide").id
  const side = page.locator("[data-editor-panel]")
  const log = side.getByRole("log")
  const canvas = page.locator("[data-slide-box]")
  const composer = side.getByRole("textbox", { name: airaCopy.askAira })
  await expect(composer).toBeVisible()
  await capture("doom-agent-panel")
  note(`opened doom deck ${deck} at revision ${String(opened.rev)}; the Agent panel shows the Ask Aira composer`)

  aira([{ name: "add-kpi.sse", fill: { deck, base: String(opened.rev), slide } }, { name: "added-kpi.sse" }])
  const { release } = await holdReply(mcpRoutes.mcp)
  await composer.fill(asked)
  await page.keyboard.press("Enter")
  await expect(log.getByText(asked, { exact: true })).toBeVisible()
  await expect(log.getByText("I will add three KPIs to the slide.", { exact: true })).toBeVisible()
  await expect(log.locator('[data-tool-state="working"]')).toHaveText(airaStepWords.edit_deck.working)
  await expect(side.getByRole("button", { name: "Stop" })).toBeVisible()
  await capture("working")
  note("the reply streamed and the Editing slides step waits on /mcp with Stop showing")

  await release()
  await expect(canvas.getByText("$4.2M", { exact: true })).toBeVisible()
  await expect(log.getByText("The slide now shows revenue, customers and churn.", { exact: true })).toBeVisible()
  await expect(log.locator('[data-tool-state="done"]')).toHaveText(airaStepWords.edit_deck.done)
  await expect(side.getByRole("button", { name: undoCopy.undo })).toBeVisible()
  await capture("done")
  note("the call went through /mcp and the canvas painted the KPIs without a reload")
}

export default async function drive(kit) {
  const { repo, page, signIn, capture, note } = kit
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  const side = page.locator("[data-editor-panel]")
  await expect(side.getByRole("textbox", { name: airaCopy.askAira })).toBeVisible()
  await capture("agent-panel")
  note("imported clean.pptx; the Agent panel shows the Ask Aira composer")
  await doomAgent(kit, cookie)
}
