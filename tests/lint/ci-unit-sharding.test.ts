import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { z } from "zod"
import { measuredPartitions } from "../../scripts/gate/unit-sharding.ts"

const durations = z.record(z.string(), z.number().positive()).parse(JSON.parse(readFileSync("scripts/gate/unit-durations.json", "utf8")))

it("balances the measured workload and includes new files exactly once", () => {
  const files = [...Object.keys(durations), "apps/future/new.spec.ts", "packages/future/new.test.tsx"]
  const groups = measuredPartitions(files, 2, file => file)
  expect(groups.flat().sort()).toEqual([...files].sort())
  const totals = groups.map(group => group.reduce((sum, file) => sum + (durations[file] ?? 1), 0))
  expect(Math.abs((totals[0] ?? 0) - (totals[1] ?? 0))).toBeLessThan(1)
  expect(measuredPartitions([...files].reverse(), 2, file => file)).toEqual(groups)
})
