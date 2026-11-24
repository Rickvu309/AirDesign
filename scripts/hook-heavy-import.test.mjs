import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { hookHeavyFaults } from "./hook-heavy-import.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const withTempRepo = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-hook-heavy-"))
  for (const [relative, content] of Object.entries(files)) {
    const full = path.join(root, relative)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content)
  }
  try {
    return hookHeavyFaults(root)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

const panel = (imports) => ["apps/web/src/editor/panel.tsx", imports, "export const Panel = () => null"].join("\n")

const hook = (specifier) =>
  [
    'import { beforeAll } from "vitest"',
    "beforeAll(async () => {",
    `  await import(${JSON.stringify(specifier)})`,
    "})",
  ].join("\n")

const doomHook = withTempRepo({
  "apps/web/src/editor/panel.test.tsx": hook("./panel"),
  "apps/web/src/editor/panel.tsx": panel('import * as doom from "@airdesign/doom"'),
})
assert.equal(doomHook.length, 1)
assert.match(doomHook[0], /panel\.test\.tsx:2: beforeAll imports \.\/panel/)
assert.match(doomHook[0], /panel\.tsx loads @airdesign\/doom/)

const catalogHook = withTempRepo({
  "apps/web/src/editor/panel.test.tsx": hook("./panel"),
  "apps/web/src/editor/panel.tsx": panel('import { iconNames } from "@airdesign/catalog"'),
})
assert.equal(catalogHook.length, 1)
assert.match(catalogHook[0], /loads @airdesign\/catalog/)

const throughChild = withTempRepo({
  "apps/web/src/editor/panel.test.tsx": hook("./panel"),
  "apps/web/src/editor/panel.tsx": panel('import { names } from "./names"'),
  "apps/web/src/editor/names.ts": 'import { iconNames } from "@airdesign/catalog"\nexport const names = iconNames\n',
})
assert.equal(throughChild.length, 1)
assert.match(throughChild[0], /names\.ts loads @airdesign\/catalog/)

const typeOnly = withTempRepo({
  "apps/web/src/editor/panel.test.tsx": hook("./panel"),
  "apps/web/src/editor/panel.tsx": panel('import type { Chart } from "@airdesign/doom"'),
})
assert.deepEqual(typeOnly, [])

const oneFile = withTempRepo({
  "apps/web/src/editor/panel.test.tsx": hook("./panel"),
  "apps/web/src/editor/panel.tsx": panel('import { iconNames } from "@airdesign/catalog/icon-names"'),
})
assert.deepEqual(oneFile, [])

const namedDoom = withTempRepo({
  "apps/web/src/editor/panel.test.tsx": hook("./panel"),
  "apps/web/src/editor/panel.tsx": panel('import { readLinkAddress } from "@airdesign/doom"'),
})
assert.deepEqual(namedDoom, [])

const atTop = withTempRepo({
  "apps/web/src/editor/panel.test.tsx": [
    'import { beforeAll } from "vitest"',
    'import { Panel } from "./panel"',
    "beforeAll(async () => {",
    '  await import("jsdom")',
    "})",
    "export const opened = Panel",
  ].join("\n"),
  "apps/web/src/editor/panel.tsx": panel('import { readLinkAddress } from "@airdesign/doom"'),
})
assert.deepEqual(atTop, [])

const repoFaults = hookHeavyFaults(repoRoot)
assert.deepEqual(repoFaults, [], repoFaults.join("\n"))

console.log("hook heavy import tests passed")
