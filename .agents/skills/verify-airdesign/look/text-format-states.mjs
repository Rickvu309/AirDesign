import path from "node:path"
import { expect } from "@playwright/test"

const design = "/screens/s43-08-editor-tools-text-format"

async function boldWord(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await kit.page.locator("input[type=file]").setInputFiles(path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  await kit.page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
  const text = kit.page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await text.press("ControlOrMeta+a")
  await text.pressSequentially("Hello world")
  await text
    .locator("[data-run]")
    .first()
    .evaluate((run) => {
      const words = run.firstChild
      if (words !== null) window.getSelection()?.setBaseAndExtent(words, 6, words, 11)
    })
  const bold = kit.page.getByRole("group", { name: "Text format" }).getByRole("button", { name: "Bold" })
  await bold.click()
  await expect(bold).toHaveAttribute("aria-pressed", "true")
}

export const textFormatStates = [{ name: "text-format-bold", design, drive: boldWord }]
