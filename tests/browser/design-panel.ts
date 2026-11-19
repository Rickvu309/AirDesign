import { join } from "node:path"
import { expect, type Locator, type Page } from "@playwright/test"
import { colorCopy } from "../../apps/web/src/copy/color-copy"

export async function setPanelMode(page: Page, mode: "slides" | "design"): Promise<void> {
  const toggle = page.locator("[data-design-mode]")
  const pressed = mode === "design" ? "true" : "false"
  if ((await toggle.getAttribute("aria-pressed")) !== pressed) await toggle.click()
  await page.waitForFunction(
    (expected) => document.querySelector("[data-design-mode]")?.getAttribute("aria-pressed") === expected,
    pressed,
  )
}

export const fixtures = join(process.cwd(), "scripts/pptx-fixtures")

type StoredRow = { readonly kind: string; readonly node?: string; readonly property?: string; readonly value?: unknown }

export async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

export async function openDeck(page: Page, file: string): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(fixtures, file))
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
}

export async function designing(page: Page, element: Locator): Promise<Locator> {
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await element.click()
  const panel = page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  return panel
}

export async function unfold(panel: Locator, title: string): Promise<void> {
  await setPanelMode(panel.page(), "design")
  const fold = panel.getByRole("heading", { name: title, exact: true }).getByRole("button")
  if ((await fold.count()) === 0) return
  if ((await fold.getAttribute("aria-expanded")) === "false") await fold.click()
  await expect(fold).toHaveAttribute("aria-expanded", "true")
}

export async function storedRows(page: Page): Promise<StoredRow[]> {
  return page.evaluate(
    () =>
      new Promise<StoredRow[]>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const all = database.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            database.close()
            resolve(
              (all.result as StoredRow[]).filter((row) => typeof row === "object" && row !== null && "kind" in row),
            )
          }
        }
      }),
  )
}

export async function pendingValues(page: Page, node: string): Promise<unknown[]> {
  return (await storedRows(page)).filter((row) => row.kind === "pending" && row.node === node).map((row) => row.value)
}

export function placed(page: Page, element: string): Promise<number[]> {
  return page
    .locator(`[data-slide-paint] [data-canvas-element="${element}"]`)
    .evaluate((frame: HTMLElement) =>
      [frame.style.left, frame.style.top, frame.style.width, frame.style.height].map((each) => Number.parseFloat(each)),
    )
}

export function picker(page: Page): Locator {
  return page.locator("[data-color-picker]")
}

export async function pickColor(page: Page, field: Locator, name: string): Promise<void> {
  await field.getByRole("button").first().click()
  await picker(page).getByRole("button", { name, exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(picker(page)).toHaveCount(0)
  await expect(shownColor(field)).toHaveText(name)
}

export async function typeColor(page: Page, trigger: Locator, hex: string): Promise<void> {
  await trigger.click()
  const menu = picker(page)
  const typed = menu.getByRole("textbox", { name: colorCopy.hex, exact: true })
  if ((await typed.count()) === 0) await menu.getByRole("button", { name: colorCopy.add, exact: true }).click()
  await typed.fill(hex)
  await typed.press("Enter")
  await page.keyboard.press("Escape")
  await expect(menu).toHaveCount(0)
}

export function shownColor(field: Locator): Locator {
  return field.getByRole("button").first()
}

const field = /^(\s*)- (textbox|combobox|slider|spinbutton|checkbox|switch|radiogroup|group) "([^"]+)"/

export async function unfoldAll(panel: Locator): Promise<void> {
  await setPanelMode(panel.page(), "design")
  const folded = panel.getByRole("heading").getByRole("button", { expanded: false })
  while ((await folded.count()) > 0) {
    const title = await folded.first().textContent()
    await folded.first().click()
    await expect(
      panel.getByRole("heading", { name: title ?? "", exact: true }).getByRole("button", { expanded: true }),
    ).toBeVisible()
  }
}

export async function sharedNames(panel: Locator): Promise<string[]> {
  const lines = (await panel.ariaSnapshot()).split("\n")
  const names = lines.flatMap((line, at) => {
    const [, indent = "", role, name] = field.exec(line) ?? []
    if (name === undefined) return []
    const choices = (lines[at + 1] ?? "").startsWith(`${indent}  - button`)
    return role === "group" && !choices ? [] : [name]
  })
  return [...new Set(names.filter((name, at) => names.indexOf(name) !== at))]
}

export async function openFillDetails(panel: Locator): Promise<void> {
  await setPanelMode(panel.page(), "design")
  const details = panel.locator("[data-fill-details]")
  const fold = details.getByRole("button").first()
  if ((await fold.getAttribute("aria-expanded")) !== "true") await fold.click()
  await expect(fold).toHaveAttribute("aria-expanded", "true")
}
