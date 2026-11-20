import { expect, type Page } from "@playwright/test"
import { zoomCopy, zoomToOf } from "../../apps/web/src/copy/product-copy"
import { decksOn } from "./deck-test"

export type Row = {
  readonly group: string
  readonly truth: number
  readonly said: number | null
  readonly label: string
}

export async function openDeck(page: Page, name: string, buffer: Buffer): Promise<void> {
  await decksOn(page).open({
    name,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer,
  })
}

export async function zoomTo(page: Page, step: number | "fit"): Promise<void> {
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemradio", { name: step === "fit" ? zoomCopy.fit : zoomToOf(step), exact: true }).click()
  await expect(page.getByRole("menu")).toHaveCount(0)
}

export async function showSlide(page: Page, number: number): Promise<void> {
  const entry = page.locator(`[data-slide-entry="${number}"]`)
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
  await decksOn(page).ready()
}

function ratios(): () => number {
  let seed = 11
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return 0.7 + (0.6 * ((mixed ^ (mixed >>> 14)) >>> 0)) / 4_294_967_296
  }
}

export function overflowAgreement(rows: readonly Row[]): number {
  const ratio = ratios()
  const judged = rows.filter((row) => row.said !== null)
  let agree = 0
  for (const row of judged) {
    const room = row.truth * ratio()
    if (row.truth > room + 1 === (row.said ?? 0) > room + 1) agree += 1
  }
  return agree / Math.max(1, judged.length)
}

export function agreementTable(rows: readonly Row[]): string {
  const ratio = ratios()
  const lines = [
    "| group | cases | judged | height within 0.5 pt | within 1 pt | median error | 90th | worst | overflow agrees | missed | false alarms |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ]
  for (const group of [...new Set(rows.map((row) => row.group))]) {
    const mine = rows.filter((row) => row.group === group)
    const judged = mine.filter((row): row is Row & { said: number } => row.said !== null)
    const errors = judged.map((row) => Math.abs(row.said - row.truth)).sort((a, b) => a - b)
    let agree = 0
    let missed = 0
    let alarms = 0
    for (const row of judged) {
      const room = row.truth * ratio()
      const real = row.truth > room + 1
      const said = row.said > room + 1
      if (real === said) agree += 1
      else if (real) missed += 1
      else alarms += 1
    }
    const at = (share: number) =>
      (errors[Math.min(errors.length - 1, Math.floor(errors.length * share))] ?? 0).toFixed(2)
    const share = (count: number) => `${count} (${((100 * count) / Math.max(1, judged.length)).toFixed(1)}%)`
    lines.push(
      `| ${group} | ${mine.length} | ${judged.length} | ${share(errors.filter((error) => error <= 0.5).length)} | ${share(errors.filter((error) => error <= 1).length)} | ${at(0.5)} | ${at(0.9)} | ${(errors.at(-1) ?? 0).toFixed(2)} | ${share(agree)} | ${missed} | ${alarms} |`,
    )
  }
  return lines.join("\n")
}

export function within(rows: readonly Row[], group: string, points: number): number {
  const judged = rows.filter((row) => row.group === group && row.said !== null)
  return judged.filter((row) => Math.abs((row.said ?? 0) - row.truth) <= points).length / Math.max(1, judged.length)
}

export function worst(rows: readonly Row[], count: number): string {
  return rows
    .filter((row) => row.said !== null)
    .sort((a, b) => Math.abs((b.said ?? 0) - b.truth) - Math.abs((a.said ?? 0) - a.truth))
    .slice(0, count)
    .map((row) => `${row.group} ${row.label}: painted ${row.truth.toFixed(2)} said ${row.said?.toFixed(2)}`)
    .join("\n")
}
