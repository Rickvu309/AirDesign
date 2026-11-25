import { expect, test } from "./deck-test"

test("each corpus bake agrees with the canvas within half a slide pixel or is refused", async ({}, info) => {
  const { bakeParity } = await import("./font-layout/bake-parity.mjs")
  const results: readonly {
    id: string
    width: number | null
    difference: number
    savedDifference: number | undefined
    answer: { ok: boolean; reason?: string }
  }[] = await bakeParity()
  await info.attach("Canvas and agent bake parity", { body: JSON.stringify(results), contentType: "application/json" })
  expect(results).toHaveLength(410)
  expect(
    results
      .filter(({ id }) => id === "legacy-soft-hyphens" || id.startsWith("latin-color-kerning"))
      .every(({ answer, savedDifference }) => answer.ok && (savedDifference ?? Infinity) <= 0.5),
  ).toBe(true)
  for (const result of results) {
    const label = `${result.id} at ${String(result.width)}`
    if (result.answer.ok) expect(result.savedDifference, label).toBeLessThanOrEqual(0.5)
    else {
      expect(result.answer.reason, label).toMatch(/^(shaping|coverage)$/)
      expect(result.difference, label).toBeGreaterThan(0.5)
    }
  }
})

test("business titles and Japanese text with isolated punctuation bake in the served fonts", async ({}, info) => {
  const { bakeParity } = await import("./font-layout/bake-parity.mjs")
  const rows: readonly {
    group: string
    id: string
    savedDifference: number | undefined
    answer: { ok: boolean; reason?: string }
  }[] = await bakeParity(true)
  const shares = [...new Set(rows.map(({ group }) => group))].map((group) => {
    const samples = rows.filter((row) => row.group === group)
    return { group, total: samples.length, refused: samples.filter(({ answer }) => !answer.ok).length }
  })
  await info.attach("Refusals by theme", {
    body: JSON.stringify({ shares, rows }, null, 2),
    contentType: "application/json",
  })
  for (const { group, id, answer, savedDifference } of rows) {
    if (group === "japanese-inter" && !answer.ok) {
      expect(answer.reason, id).toMatch(/^coverage$/)
      continue
    }
    expect(answer.ok, `${group}: ${id}`).toBe(true)
    expect(savedDifference, id).toBeLessThanOrEqual(0.5)
  }
})
