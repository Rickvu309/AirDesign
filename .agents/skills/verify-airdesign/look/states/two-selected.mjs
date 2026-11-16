import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const part = "ppt/slides/slide1.xml"

export function shapeFrame(page, node) {
  return page.locator(`[data-slide-paint] [data-canvas-element="${part}#${node.split(".")[1]}"]`)
}

function shown(page) {
  return page
    .locator("[data-slide-paint] [data-canvas-element]")
    .evaluateAll((nodes) => nodes.map((node) => `256.${node.getAttribute("data-canvas-element")?.split("#")[1] ?? ""}`))
}

export async function selectTwo(kit) {
  const { page } = kit
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  const before = await shown(page)
  for (const name of ["Rectangle", "Ellipse"]) {
    await page.getByRole("button", { name: "Shapes", exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
  }
  await expect.poll(async () => (await shown(page)).length).toBe(before.length + 2)
  const [first, second] = (await shown(page)).filter((node) => !before.includes(node))
  await shapeFrame(page, first).click()
  await shapeFrame(page, second).click({ modifiers: ["ControlOrMeta"] })
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(2)
  await expect(page.locator("[data-slide-paint] [data-selection-around]")).toHaveAttribute("data-selection-around", "2")
  return { deck: page.url().split("/").at(-1), first, second }
}

async function drive(kit) {
  await kit.signIn()
  await selectTwo(kit)
}

export default { name: "two-selected", design: editor, drive }
