import path from "node:path"
import { expect } from "@playwright/test"

export default async function drive({ repo, page, signIn, capture, note }) {
  const shown = []
  await page.exposeFunction("deckShown", (text) => {
    shown.push(text)
  })
  await page.addInitScript(() => {
    const watch = new MutationObserver(() => {
      const ready = document.querySelector(".thin-page[data-deck-ready]")
      if (ready === null) return
      watch.disconnect()
      window.deckShown(document.querySelector("[data-slide-paint]")?.textContent ?? "")
    })
    watch.observe(document, { childList: true, subtree: true, attributes: true })
  })
  const signInAddress = (deck) => `https://airdesign.app/sign-in?next=${encodeURIComponent(`/deck/${deck}`)}`

  async function importDeck() {
    await page.goto("/")
    await page.locator("input[type=file]").setInputFiles(path.join(repo, "scripts/pptx-fixtures/clean.pptx"))
    await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
    await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
    return page.url().split("/").at(-1)
  }

  const { email } = await signIn()
  const first = await importDeck()
  await page.goto("/")
  await page.getByRole("button", { name: email }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/airdesign\.app\/sign-in/)
  shown.length = 0
  await page.goto(`/deck/${first}`)
  await expect(page).toHaveURL(signInAddress(first))
  expect(shown).toEqual([])
  await capture("signed-out-from-home")
  note(
    `signed out from the account menu on Home, then opened /deck/${first}: sent to sign-in with next, and no slide painted`,
  )

  await signIn()
  const second = await importDeck()
  await page.goto("/settings/account")
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/airdesign\.app\/sign-in/)
  shown.length = 0
  await page.goto(`/deck/${second}`)
  await expect(page).toHaveURL(signInAddress(second))
  expect(shown).toEqual([])
  await capture("signed-out-from-settings")
  note(
    `signed out with Sign out in Settings, then opened /deck/${second}: sent to sign-in with next, and no slide painted`,
  )
}
