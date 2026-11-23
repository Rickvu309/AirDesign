import { expect } from "@playwright/test"
import { openDoomDeck } from "./doom-deck.mjs"
import { writeProps } from "./doom-text.mjs"

const notes =
  "Open with the bill: heat pumps cut a typical heating bill by a third.\nThen the two numbers that matter, install cost and payback.\nClose on the rebate and what it asks of the buyer."

export async function notesState(kit, open = false) {
  const { page } = kit
  const opened = await openDoomDeck(kit)
  await writeProps(kit, opened, opened.slide, {
    notes: {
      chars: notes,
      spans: [],
      paras: notes.split("\n").map(() => ({})),
      style: "body",
      resize: "fixed",
      alignV: "top",
    },
  })
  await expect(page.getByText("Then the two numbers that matter", { exact: false })).toBeVisible()
  await page.getByRole("button", { name: "Collapse presenter notes" }).click()
  if (open) await page.getByRole("button", { name: "Expand presenter notes" }).click()
  return opened
}
