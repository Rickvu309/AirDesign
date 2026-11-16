import { gestures } from "@airdesign/render"
import { describe, expect, it } from "vitest"

const specs: Readonly<Record<string, string>> = import.meta.glob("../../../tests/browser/*.spec.ts", {
  query: "?raw",
  import: "default",
  eager: true,
})

const covered = Object.values(specs).flatMap((text) =>
  [...text.matchAll(/\bcovers\(([^)]*)\)/g)].flatMap((call) =>
    [...(call[1] ?? "").matchAll(/"([^"]+)"/g)].map((id) => id[1] ?? ""),
  ),
)

describe("every gesture in the table", () => {
  it.each(gestures.map((row) => row.id))("%s has a browser test that covers it", (id) => {
    expect(covered).toContain(id)
  })

  it("names no gesture outside the table in a browser test", () => {
    const known: readonly string[] = gestures.map((row) => row.id)
    expect(covered.filter((id) => !known.includes(id))).toEqual([])
  })
})
