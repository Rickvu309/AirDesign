import assert from "node:assert/strict"
import path from "node:path"
import { createVitest } from "vitest/node"

const root = path.resolve(import.meta.dirname, "..")
const ctx = await createVitest({ root, watch: false, run: true, reporters: [] })
try {
  const shared = ctx.projects.filter((project) => project.config.isolate !== true).map((project) => project.name)
  assert.deepEqual(shared, [], "every Vitest project must isolate each test file")
} finally {
  await ctx.close()
}

console.log("every Vitest project isolates each test file")
