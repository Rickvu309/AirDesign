import type { Page } from "@playwright/test"

export async function insertTable(page: Page, rows = 3, columns = 3): Promise<void> {
  await page.getByRole("button", { name: "Insert table", exact: true }).click()
  const size = `${rows} ${rows === 1 ? "row" : "rows"}, ${columns} ${columns === 1 ? "column" : "columns"}`
  await page.getByRole("group", { name: "Table size" }).getByRole("button", { name: size, exact: true }).click()
}
