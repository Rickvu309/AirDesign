import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const comparePaths = (left, right) => (left < right ? -1 : left > right ? 1 : 0)

export const referencePath = (item) => (typeof item === "string" ? item : (item?.path ?? ""))

export const sortedReferences = (references) =>
  [...(Array.isArray(references) ? references : [])].sort((left, right) =>
    comparePaths(referencePath(left), referencePath(right)),
  )

export const referenceOrderMessage = "Sort the references in tsconfig.json by path."

export const unsortedReferences = (references) => {
  const paths = (Array.isArray(references) ? references : []).map(referencePath)
  const sorted = [...paths].sort(comparePaths)
  if (paths.every((item, index) => item === sorted[index])) return []
  return [referenceOrderMessage]
}

const workspaceRoot = (start) => {
  let dir = path.resolve(start)
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return undefined
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = workspaceRoot(process.cwd())
  if (root === undefined) {
    console.error("pnpm-workspace.yaml not found")
    process.exit(1)
  }
  const tsconfig = JSON.parse(readFileSync(path.join(root, "tsconfig.json"), "utf8"))
  const problems = unsortedReferences(tsconfig.references)
  if (problems.length > 0) {
    console.error(problems.join("\n"))
    process.exit(1)
  }
}
