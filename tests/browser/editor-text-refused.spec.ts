import { expect } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { test } from "./api-stack"
import { clickSlide, openDoomEditor, savedNode } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
type Sent = { readonly edit?: { readonly writes?: readonly { readonly prop?: string }[] } }

test("a text commit the server refuses keeps the words in the text box with a notice, and leaving again saves them", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  const box = (await savedNode(stack, opened, "s:4"))?.box as Box
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  let refused = 0
  await page.route(`**${doomRoutes.edit.path}`, async (route) => {
    const sent = route.request().postDataJSON() as Sent
    if (refused > 0 || !(sent.edit?.writes ?? []).some((write) => write.prop === "text")) return route.fallback()
    refused += 1
    return route.fulfill({ json: { ok: false, refusal: "edit", refused: "stale", node: "s:4", prop: "text" } })
  })
  await clickSlide(page, box.x + box.w / 2, box.y + box.h / 2)
  await page.keyboard.press("Enter")
  const editor = page.locator("[data-text-editor]")
  await expect(editor).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type("Words worth keeping")
  await page.keyboard.press("Escape")

  await expect(page.getByText(productCopy.textRefused, { exact: true })).toBeVisible()
  await expect(editor).toHaveText("Words worth keeping")
  expect(refused).toBe(1)

  await editor.focus()
  await page.keyboard.press("Escape")
  await expect(editor).toHaveCount(0)
  await expect
    .poll(async () => ((await savedNode(stack, opened, "s:4"))?.text as { chars?: string } | undefined)?.chars)
    .toBe("Words worth keeping")
  await expect(page.locator("[data-slide-box] [data-line]").filter({ hasText: "Words worth keeping" })).toHaveCount(1)
})
