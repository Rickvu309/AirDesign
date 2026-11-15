export async function unfold(panel, title) {
  const fold = panel.getByRole("heading", { name: title, exact: true }).getByRole("button")
  if ((await fold.count()) === 0) return
  if ((await fold.getAttribute("aria-expanded")) === "false") await fold.click()
}
