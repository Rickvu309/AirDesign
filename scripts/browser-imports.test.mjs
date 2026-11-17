import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const root = mkdtempSync(path.join(os.tmpdir(), "browser-imports-"))
const write = (file, source) => {
  const target = path.join(root, file)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, source)
}
const check = () => spawnSync(process.execPath, ["scripts/browser-imports.mjs", root], { encoding: "utf8" })
try {
  write("tests/browser/lazy.spec.ts", "export const load = (file: string) => import(file)")
  write("copy.ts", 'export const actualCopy = "kept"')
  for (const name of ["productCopy", "creditsCopy"]) {
    write(
      ".agents/skills/verify-airdesign/look/states/lazy.mjs",
      `import { ${name} } from "../../../../../copy.ts"; export default () => ${name}`,
    )
    const failed = check()
    assert.equal(failed.status, 1)
    assert.match(failed.stderr, /lazy.mjs/)
    assert.ok(failed.stderr.includes(name), failed.stderr)
  }
  write(
    ".agents/skills/verify-airdesign/look/states/lazy.mjs",
    'import { actualCopy } from "../../../../../copy.ts"; throw new Error("must never execute"); export default () => actualCopy',
  )
  assert.equal(check().status, 0)
  write("packages/copy/src/index.ts", 'export { actualCopy } from "../../../copy.ts"')
  write(
    "tests/browser/lazy.spec.ts",
    'import { actualCopy } from "../../packages/copy/dist/index.js"; export const copy = actualCopy',
  )
  assert.equal(check().status, 0)
  write("packages/copy/src/index.ts", 'export { missingCopy } from "../../../copy.ts"')
  write(
    "tests/browser/lazy.spec.ts",
    'import { absentCopy } from "../../packages/copy/dist/index.js"; export const copy = absentCopy',
  )
  assert.equal(check().status, 1)
  write("tests/browser/lazy.spec.ts", 'export const load = () => import("./missing.ts")')
  const missing = check()
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /missing.ts/)
} finally {
  rmSync(root, { recursive: true, force: true })
}

const { stagesFor, runCheck } = await import("./check.mjs")
const { cheapSteps } = await import("./gate.mjs")
for (const chosen of [cheapSteps, ...["main", "side", "browser", "design"].map((part) => stagesFor(part, true))]) {
  const ran = []
  const result = await runCheck({
    chosen,
    run: async ([name]) => {
      ran.push(name)
      return name === "browser-imports" ? 1 : 0
    },
    lock: async () => {
      assert.fail("broken imports must stop before a machine slot or browser starts")
    },
  })
  assert.ok(ran.includes("browser-imports"))
  assert.deepEqual(result.failed, ["browser-imports"])
}
