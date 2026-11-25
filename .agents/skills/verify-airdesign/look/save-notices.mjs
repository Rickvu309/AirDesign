import { expect } from "@playwright/test"
import { openDoomDeck, selectNode } from "./doom-deck.mjs"

export const editAnswers = (kit, answer) =>
  kit.page.route(`**${kit.doomRoutes.edit.path}`, (route) =>
    answer === undefined ? route.abort("connectionfailed") : route.fulfill({ json: answer }),
  )

export async function cutOff(kit) {
  await expect(kit.page.locator("[data-fonts-pending]")).toHaveCount(0)
  await kit.page.route(
    (url) => url.pathname.startsWith("/doom/"),
    (route) => route.abort("internetdisconnected"),
  )
  await kit.context.setOffline(true)
}

export async function nudgeTitle(page) {
  await selectNode(page, "s:4")
  await page.keyboard.press("ArrowRight")
}

export async function noticeAfterEdit(kit, cut, told, edits = 1) {
  await openDoomDeck(kit)
  await cut(kit)
  for (let count = 1; count <= edits; count += 1) await nudgeTitle(kit.page)
  await expect(kit.page.getByText(told, { exact: true })).toBeVisible()
}
