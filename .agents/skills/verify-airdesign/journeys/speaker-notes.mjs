import path from "node:path"
import { expect } from "@playwright/test"

const typed = "Remember the result & the next step.\nThank everyone."

export default async function drive({ repo, page, context, signIn, post, capture, note, deckRoutes }) {
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/nasa-1d-cnn.pptx"))
  await expect(page.locator("[data-deck-ready]")).toHaveAttribute("data-deck-ready", /.+/)
  await capture("notes-closed")
  await page.getByRole("button", { name: "Expand speaker notes" }).first().click()
  const field = page.getByRole("textbox", { name: "Speaker notes", exact: true })
  await expect(field).toBeEditable()
  await capture("notes-open")
  await page.locator('[data-slide-entry="2"]').click()
  await expect(field).not.toBeEditable()
  await expect(page.getByText("Speaker notes can't be edited on this slide yet.").first()).toBeVisible()
  await page.locator('[data-slide-entry="1"]').click()
  await expect(field).toBeEditable()
  await context.setOffline(true)
  await field.fill(typed)
  await expect(page.getByText("You're offline. Edits are saved on this device.", { exact: true })).toBeVisible()
  await context.setOffline(false)
  const deck = page.url().split("/").at(-1)
  await expect
    .poll(async () => {
      const opened = await post(deckRoutes.open, { deck }, cookie)
      return Object.entries(opened.json.register.elements)
        .filter(([key]) => key.endsWith(".notes"))
        .flatMap(([, value]) => value.landed.filter((row) => row.visible).map((row) => row.value))
    })
    .toContain(typed)
  await page.reload()
  await page.getByRole("button", { name: "Expand speaker notes" }).first().click()
  await expect(field).toHaveValue(typed)
  await capture("notes-reloaded")
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" })).toBeFocused()
  await page.keyboard.press("Enter")
  const file = await download
  const saved = await file.path()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "edited-notes.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await (await import("node:fs/promises")).readFile(saved),
  })
  await expect(page.locator("[data-deck-ready]")).toHaveAttribute("data-deck-ready", /.+/)
  await page.getByRole("button", { name: "Expand speaker notes" }).first().click()
  await expect(field).toHaveValue(typed)
  await capture("notes-reimported")
  note("Typed notes offline, saw the server copy, reloaded, exported and re-imported the PowerPoint; notes matched.")
}
