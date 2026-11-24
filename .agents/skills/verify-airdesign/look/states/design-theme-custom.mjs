import { expect } from "@playwright/test"
import { designCopy } from "../../bin/product-copy.mjs"
import { designing } from "../doom-design.mjs"
import { readDoom } from "../doom-deck.mjs"

async function drive(kit) {
  const opened = await designing(kit, "text", "shape")
  const { fold } = await readDoom(kit, opened)
  const deck = Object.values(fold.nodes).find((node) => node.theme !== undefined)
  if (deck === undefined) throw new Error("No saved theme")
  const edit = {
    author: { kind: "agent", id: "aira", run: "theme-preview" },
    phase: "start",
    once: "tweak-accent",
    writes: [{ node: deck.id, prop: "theme.colors.accent1", value: "#a63678" }],
  }
  const landed = await kit.post(kit.doomRoutes.edit, { deck: opened.deck, edit }, opened.cookie)
  expect(landed.json.ok).toBe(true)
  const picker = kit.page.getByRole("combobox", { name: designCopy.chooseTheme(designCopy.customTheme) })
  await expect(picker).toBeVisible()
  await picker.click()
  await expect(kit.page.getByRole("listbox")).toBeVisible()
}

export default { name: "design-theme-custom", design: null, drive }
