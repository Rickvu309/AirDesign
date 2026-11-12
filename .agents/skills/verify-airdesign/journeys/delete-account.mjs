import path from "node:path"
import { expect } from "@playwright/test"

async function databases(page) {
  return page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name))
}

export default async function drive({ repo, origin, page, signIn, post, capture, note, deckRoutes }) {
  const { cookie, email } = await signIn()
  note(`signed in as ${email} through the emailed code`)
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect.poll(async () => (await post(deckRoutes.original, { deck }, cookie)).json.ok).toBe(true)
  const original = (await post(deckRoutes.original, { deck }, cookie)).json.url
  expect((await fetch(new URL(original, origin))).status).toBe(200)
  note(`imported clean.pptx as deck ${deck}; its stored original downloads`)

  await page.goto("/")
  await expect(page.getByRole("heading", { name: "clean", exact: true })).toBeVisible()
  expect(await databases(page)).toContain("airdesign")
  await page.getByRole("button", { name: email }).click()
  await page.getByRole("menuitem", { name: "Delete account" }).click()
  const dialog = page.getByRole("dialog", { name: "Delete your account?" })
  const remove = dialog.getByRole("button", { name: "Delete account" })
  await expect(remove).toBeDisabled()
  await capture("delete-account-asks")
  await dialog.getByLabel("Type your email to confirm").fill(email)
  await expect(remove).toBeEnabled()
  await expect(remove).toHaveCSS("opacity", "1")
  await capture("delete-account-typed")
  await remove.click()
  await expect(page.getByRole("heading", { name: "Sign in or create an account" })).toBeVisible()
  await capture("after-delete")
  note(
    `Delete account in the account menu, with the email typed, lands on ${new URL(page.url()).pathname}${new URL(page.url()).search}`,
  )

  const listed = await post(deckRoutes.list, {}, cookie)
  expect([listed.status, listed.json]).toEqual([401, { ok: false, refusal: "session" }])
  expect((await fetch(new URL(original, origin))).status).toBe(404)
  expect(await databases(page)).not.toContain("airdesign")
  note(
    `after delete, ${deckRoutes.list.path} refuses the old cookie, the original is gone from the store, and the browser holds no airdesign database`,
  )
}
