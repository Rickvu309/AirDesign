import fc from "fast-check"
import { expect, it } from "vitest"
import { slideId, type SlideId } from "./element-id.js"
import { slideGroups } from "./slide-groups.js"

const sizes = fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 0, maxLength: 5 })

function sectionedDeck(lengths: readonly number[], extra: number) {
  const total = lengths.reduce((sum, size) => sum + size, 0) + extra
  const file = Array.from({ length: Math.max(1, total) }, (_, index) => slideId(String(256 + index)))
  const runs: SlideId[][] = []
  let offset = 0
  for (const size of lengths) {
    if (offset >= file.length) break
    runs.push(file.slice(offset, offset + size))
    offset += size
  }
  const last = runs.at(-1)
  if (last !== undefined) last.push(...file.slice(offset))
  return { file, starts: runs.map((run) => run[0]!), runs }
}

it("reads an untouched deck as exactly the file's sections", () => {
  fc.assert(
    fc.property(sizes, fc.nat(4), (lengths, extra) => {
      const { file, starts, runs } = sectionedDeck(lengths, extra)
      const groups = slideGroups({ file, order: [], sectionStarts: starts })
      const expected = runs.length === 0 ? [file] : runs
      expect(groups.map((group) => group.slides)).toEqual(expected)
      expect(groups.map((group) => group.key)).toEqual(expected.map((_, k) => `f${String(k)}`))
    }),
  )
})
