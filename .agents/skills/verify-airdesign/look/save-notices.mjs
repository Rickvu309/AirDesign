import { expect } from "@playwright/test"
import { openDoomDeck } from "./doom-deck.mjs"
import { editText, leaveText } from "./doom-text.mjs"

export const editAnswers = (kit, answer) =>
  kit.page.route(`**${kit.doomRoutes.edit.path}`, (route) =>
    answer === undefined ? route.abort("connectionfailed") : route.fulfill({ json: answer }),
  )

export async function cutOff(kit) {
  await kit.page.route(
    (url) => url.pathname.startsWith("/doom/"),
    (route) => route.abort("internetdisconnected"),
  )
  await kit.context.setOffline(true)
}

export async function typeTitle(page, words) {
  await editText(page, "s:4")
  await page.keyboard.press("End")
  await page.keyboard.type(words)
  await leaveText(page)
}

export async function noticeAfterEdit(kit, cut, told, edits = 1) {
  await openDoomDeck(kit)
  await cut(kit)
  for (let count = 1; count <= edits; count += 1) await typeTitle(kit.page, ` ${String(count)}`)
  await expect(kit.page.getByText(told, { exact: true })).toBeVisible()
}
