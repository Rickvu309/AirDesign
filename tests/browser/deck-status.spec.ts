import { expect, test, type Page } from "@playwright/test"
import { openRegister } from "../../packages/document/src/index.ts"
import { stored } from "./device-store"
import { openFixture } from "./fixture-deck"

const offlineWords = "You're offline. Edits are saved on this device."
const unreachedWords = "Unable to reach AirDesign. Edits are saved on this device."

test.use({ viewport: { width: 1600, height: 1000 } })

async function typeAtEnd(page: Page, text: string): Promise<void> {
  const editor = page.locator('[contenteditable="true"]')
  await editor.dblclick()
  await page.keyboard.press("End")
  await editor.pressSequentially(text, { delay: 50 })
}

test("a device that stayed online says AirDesign cannot be reached, and the words go when a commit is answered 404", async ({
  page,
}) => {
  let status: number | null = null
  await page.route("**/decks/{open,index}", async (route) => {
    const body = route.request().postDataJSON() as { deck: string }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, deck: body.deck, revision: 0, register: openRegister("", "") }),
    })
  })
  await page.route("**/decks/commit", async (route) => {
    if (status === null) {
      await route.abort("connectionfailed")
      return
    }
    await route.fulfill({ status, contentType: "text/html", body: "<html><body>Not found</body></html>" })
  })
  await openFixture(page)
  await expect(page.locator('[contenteditable="true"]')).toHaveText("Hello")
  await typeAtEnd(page, "!")
  await stored(page, "Hello!")
  await expect(page.getByText(unreachedWords)).toBeVisible()
  await expect(page.getByText(offlineWords)).toHaveCount(0)
  status = 404
  await typeAtEnd(page, "!")
  await stored(page, "Hello!!")
  await expect(page.getByText(unreachedWords)).toHaveCount(0)
})
