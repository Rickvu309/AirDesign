import { expect, type Page } from "@playwright/test"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
import { forward, signInBrowser, test } from "./api-stack"

const node = "256.2"

function value(text: string): string {
  return JSON.stringify([{ from: 0, runs: [{ from: 0, text }] }])
}

function pending(page: Page) {
  return page.locator("[data-slide-paint] [data-fonts-pending]")
}

test.use({ viewport: { width: 1600, height: 1000 } })

async function holdFonts(page: Page): Promise<() => void> {
  let release = () => {}
  const held = new Promise<void>((done) => {
    release = done
  })
  await page.route("**/fonts/family*", async (route) => {
    await held
    await route.fallback().catch(() => undefined)
  })
  return release
}

test("a person's typing stays on a slide whose font arrives while they type", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const release = await holdFonts(page)
  try {
    await decks.openHeld()
    const editor = page.locator('[contenteditable="true"]')
    await expect(pending(page).first()).toBeAttached()
    await editor.dblclick()
    await page.keyboard.press("ControlOrMeta+a")
    await editor.pressSequentially("Typed early", { delay: 30 })
    await expect(editor).toHaveText("Typed early")
    release()
    await expect(pending(page)).toHaveCount(0)
    await expect(editor).toHaveText("Typed early")
    await editor.pressSequentially(" and late", { delay: 30 })
    await expect(editor).toHaveText("Typed early and late")
  } finally {
    release()
  }
})
