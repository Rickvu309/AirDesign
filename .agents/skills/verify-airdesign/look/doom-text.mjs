import { expect } from "@playwright/test"
import { clickSlide, node, openDoomDeck, selectNode, spot, words } from "./doom-deck.mjs"

export const textEditor = (page) => page.locator("[data-text-editor]")

export const textLayer = (id, chars, box = spot(160, 760, 1200, 120), more = {}) => ({
  id,
  props: { name: chars.split("\n")[0], box, text: words(chars, { paras: chars.split("\n").map(() => ({})), ...more }) },
})

export async function editText(page, id) {
  await selectNode(page, id)
  await page.keyboard.press("Enter")
  await expect(textEditor(page)).toBeFocused()
}

export async function leaveText(page) {
  await page.keyboard.press("Escape")
  await expect(textEditor(page)).toHaveCount(0)
}

export async function titleEdited(kit) {
  const opened = await openDoomDeck(kit)
  await editText(kit.page, "s:4")
  return opened
}

export async function placeText(page, x, y) {
  await page.keyboard.press("t")
  await expect(page.getByRole("button", { name: "Text", exact: true })).toHaveAttribute("aria-pressed", "true")
  await clickSlide(page, x, y)
  await expect(textEditor(page)).toBeFocused()
}

export async function writeProps(kit, opened, id, props) {
  const writes = Object.entries(props).map(([prop, value]) => ({ node: id, prop, value }))
  const edit = { once: `look-props-${String(Date.now())}`, author: { kind: "person", id: "other-tab" }, writes }
  const landed = await kit.post(kit.doomRoutes.edit, { deck: opened.deck, edit }, opened.cookie)
  if (landed.json.ok !== true) throw new Error(`writing ${id} was refused: ${JSON.stringify(landed.json)}`)
}

export async function nodeText(page, id) {
  return node(page, id).innerText()
}
