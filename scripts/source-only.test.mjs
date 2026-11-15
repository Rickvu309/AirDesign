import path from "node:path"
import { fileURLToPath } from "node:url"
import { sourceOnly } from "./source-only.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const fail = (message) => {
  throw new Error(message)
}

const guard = sourceOnly(root)
const refused = (file) => {
  try {
    guard.load(path.join(root, file))
    return false
  } catch {
    return true
  }
}

for (const file of [
  "packages/document/dist/index.js",
  "packages/pptx/dist/package-bytes.js",
  "apps/api/dist/listen.js",
  "apps/web/dist/assets/index.js",
]) {
  if (!refused(file)) fail(`a test may read ${file}, which only a build writes`)
}
if (!refused("packages/document/dist/index.js?v=1")) fail("a query hides built output from the guard")
for (const file of [
  "packages/document/src/index.ts",
  "packages/pptx/src/dist.ts",
  "apps/web/src/dist/thing.ts",
  "node_modules/vitest/dist/index.js",
]) {
  if (refused(file)) fail(`the guard refuses the source ${file}`)
}

const config = (await import(path.join(root, "vitest.config.mts"))).default
const guarded = (plugins) => (plugins ?? []).flat().some((plugin) => plugin?.name === guard.name)
if (!guarded(config.plugins)) fail("vitest.config.mts lets tests read built output")
for (const project of config.test.projects) {
  if (project.extends !== true && !guarded(project.plugins))
    fail(`the ${project.test.name} project lets its tests read built output`)
}

console.log("source only tests passed")
