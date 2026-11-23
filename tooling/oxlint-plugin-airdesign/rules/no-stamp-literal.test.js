import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-stamp-literal": "error" }
const message = "Assert a stamp floor, an ordering, or a relation to format instead of equating it to a number."
const document = "packages/document/src/slide-floor.test.ts"
const live = "packages/live/src/grid-version.test.ts"

expectRejects(
  "a command stamp pin fails",
  document,
  `import { stamps } from "./format.js"
expect(stamps.command).toBe(16)`,
  rule,
  message,
)
expectRejects(
  "an aliased row stamp pin fails",
  document,
  `import { stamps as current } from "./index.js"
expect(current["row"]).toEqual(2)`,
  rule,
  message,
)
expectRejects(
  "an index stamp pin nested in a shape fails",
  document,
  `import { stamps } from "./format.js"
expect({ stamp: stamps.index, keys: indexKeys }).toEqual({ stamp: 20, keys: {} })`,
  rule,
  message,
)
expectRejects(
  "a snapshot of the stamp object fails",
  document,
  `import { stamps } from "./format.js"
expect(stamps).toMatchObject({ command: 16 })`,
  rule,
  message,
)
expectRejects(
  "a current format pin fails",
  document,
  `import { format } from "./format.js"
expect(format).toBe(78)`,
  rule,
  message,
)
expectAccepts(
  "floors, format relations and old fixtures stay",
  document,
  `import { format, formatOf, stamps } from "./format.js"
expect(stamps.command).toBeGreaterThanOrEqual(16)
expect(format).toBeGreaterThan(stamps.command)
expect(formatOf({ format: 1 })).toBe(1)
expect({ format, count: 2 }).toEqual({ format, count: 2 })`,
  rule,
)
expectAccepts(
  "another package's formats and stamps stay",
  live,
  `expect(format).toBe(1)
expect(stamps.rows[0]?.same).toBe(true)`,
  rule,
)
