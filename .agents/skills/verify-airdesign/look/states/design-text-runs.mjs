import { createRequire } from "node:module"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { textRunsDeck } from "../../../../../scripts/pptx-fixtures/text-runs.mjs"

const { textCopy } = createRequire(import.meta.url)("../../../../../apps/web/src/copy/text-copy.ts")

async function drive(kit) {
  const pptx = await import(pathToFileURL(path.join(kit.repo, "packages/pptx/dist/index.js")).href)
  const original = await pptx.readParts(await readFile(path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx")))
  await kit.signIn()
  await kit.page.goto("/")
  await kit.page.locator("input[type=file]").setInputFiles({
    name: "text-runs.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: textRunsDeck(original),
  })
  await expect(kit.page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = kit.page.url().split("/").at(-1)
  await expect(kit.page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page.locator('[data-slide-paint] [contenteditable="true"]').click()
  await kit.page.keyboard.press("Escape")
  const words = kit.page.locator("[data-design-element]").getByRole("textbox", { name: textCopy.value, exact: true })
  await expect(words).toHaveValue("Revenue 39%\nCosts fell")
  await words.focus()
  await words.evaluate((field) => field.setSelectionRange(11, 11))
  await words.press("!")
  await words.press("ControlOrMeta+Enter")
  await expect(words).toHaveValue("Revenue 39%!\nCosts fell")
}

export default { name: "design-text-runs", design: "/screens/s43-09-editor-tools-design-element", drive }
