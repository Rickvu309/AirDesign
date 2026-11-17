import { setPanelMode } from "./panel-mode.mjs"

export async function unfold(panel, title) {
  await setPanelMode(panel.page(), "design")
  const fold = panel.getByRole("heading", { name: title, exact: true }).getByRole("button")
  if ((await fold.count()) === 0) return
  if ((await fold.getAttribute("aria-expanded")) === "false") await fold.click()
}
