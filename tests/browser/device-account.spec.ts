import { expect } from "@playwright/test"
import { forward, openClean, settled, signInBrowser, test } from "./api-stack"
import { stored } from "./device-store"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a second account on the same browser sees nothing of the first, whose unsent edit comes back and syncs", async ({
  page,
  context,
  stack,
}) => {
  const first = await stack.signIn()
  await signInBrowser(context, first)
  await forward(page, stack)
  const deck = await openClean(page)
  await page.route("**/decks/commit", (route) => route.abort())
  const editor = page.locator('[contenteditable="true"]')
  await editor.click()
  await page.keyboard.press("End")
  await editor.pressSequentially(" unsent", { delay: 30 })
  await expect(editor).toHaveText("Hello unsent")
  await stored(page, "Hello unsent")

  await context.addCookies([
    {
      name: "airdesign.session",
      value: "expired-without-sign-out",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ])
  await signInBrowser(context, await stack.signIn())
  await page.addInitScript(() => {
    const seen = { ready: false, typed: false }
    Object.assign(window, { seen })
    new MutationObserver(() => {
      if (document.querySelector(".thin-page[data-deck-ready]") !== null) seen.ready = true
      if (document.body.textContent.includes("unsent")) seen.typed = true
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
  })
  await page.goto(`/deck/${deck}`)
  await expect(page.locator("[data-deck-refused]")).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { seen: unknown }).seen)).toEqual({
    ready: false,
    typed: false,
  })
  await expect(editor).toHaveCount(0)

  await signInBrowser(context, first)
  await page.unroute("**/decks/commit")
  await page.goto(`/deck/${deck}`)
  await settled(page)
  await expect(editor).toHaveText("Hello unsent")
  await expect
    .poll(async () => JSON.stringify((await stack.saved(deck))?.register ?? {}))
    .toContain("unsent")
})
