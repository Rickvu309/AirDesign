import { undoCopy } from "../../bin/product-copy.mjs"
import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const part = "ppt/slides/slide1.xml"

export async function moveThree(kit) {
  const { page } = kit
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  const shape = (number) => page.locator(`[data-slide-paint] [data-canvas-element="${part}#${number}"]`)
  await shape(4).click()
  await shape(5).click({ modifiers: ["ControlOrMeta"] })
  await shape(3).click({ modifiers: ["ControlOrMeta"] })
  await expect(page.locator("[data-slide-paint] [data-chosen]")).toHaveCount(3)
  const grabbed = await shape(4).boundingBox()
  await page.mouse.move(grabbed.x + grabbed.width / 2, grabbed.y + grabbed.height / 2)
  await page.mouse.down()
  await page.mouse.move(grabbed.x + grabbed.width / 2 + 80, grabbed.y + grabbed.height / 2 + 40, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByRole("button", { name: undoCopy.undoNamed.move, exact: true })).toBeEnabled()
}

async function drive(kit) {
  await kit.signIn()
  await moveThree(kit)
}

export default { name: "three-moved", design: editor, drive }
