import path from "node:path"
import { fileURLToPath } from "node:url"
import { createVitest } from "vitest/node"

export const runSelectedUnitTests = async (files, maxWorkers) => {
  const selected = new Set(files.map((file) => path.resolve(file)))
  const ctx = await createVitest({ run: true, watch: false, maxWorkers })
  try {
    await ctx.standalone()
    const specs = (await ctx.globTestSpecifications()).filter((spec) => selected.has(spec.moduleId))
    const found = new Set(specs.map((spec) => spec.moduleId))
    const missing = [...selected].filter((file) => !found.has(file))
    if (missing.length > 0) throw new Error(`Vitest cannot find the selected test files: ${missing.join(", ")}`)
    await ctx.runTestSpecifications(specs)
  } finally {
    await ctx.close()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [maxWorkers, ...files] = process.argv.slice(2)
  await runSelectedUnitTests(files, Number(maxWorkers))
}
