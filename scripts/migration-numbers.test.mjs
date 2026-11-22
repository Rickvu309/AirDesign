import { migrationFault, takenNumbers } from "./migration-numbers.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}
const upTo = (count) => Array.from({ length: count }, (_, at) => ({ id: at + 1, sha256: `hash-${at + 1}` }))

const main = [...upTo(8), { id: 9, sha256: "the-connected-agents-migration" }]
const branch = [...upTo(8), { id: 9, sha256: "the-delete-account-migration" }]

same("two branches that both added migration 9 clash on 9", takenNumbers({ base: main, head: branch }), [9])
same(
  "the fault names the next free number",
  migrationFault({ base: main, head: branch }),
  "Migration 9 is already on origin/main with different sql. Give yours the next free number, 10: rebase on origin/main, rename its file in apps/api/src/platform/migrations/ to start with 0010, then run node scripts/frozen-migrations.mjs to record it.",
)
same("the same migration on both sides is no clash", migrationFault({ base: main, head: main }), undefined)
same(
  "a branch that only added the next number is no clash",
  migrationFault({ base: upTo(8), head: upTo(9) }),
  undefined,
)
same("a branch behind main that added nothing is no clash", migrationFault({ base: main, head: upTo(8) }), undefined)
same(
  "two clashes name the lowest and the number past main's highest",
  migrationFault({
    base: [...upTo(7), { id: 8, sha256: "a" }, { id: 9, sha256: "b" }],
    head: [...upTo(7), { id: 8, sha256: "c" }, { id: 9, sha256: "d" }],
  }),
  "Migration 8 is already on origin/main with different sql. Give yours the next free number, 10: rebase on origin/main, rename its file in apps/api/src/platform/migrations/ to start with 0010, then run node scripts/frozen-migrations.mjs to record it.",
)
same("a base that could not be read judges nothing", migrationFault({ base: undefined, head: branch }), undefined)
