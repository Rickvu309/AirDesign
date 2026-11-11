import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const callerFolders = ["apps/", "packages/", "scripts/", "tests/", "tooling/"]
const sourcePattern = /\.(?:ts|tsx|js|mjs|mts|astro)$/
const throughIndex = /from\s+["'](?:\.\.?\/)+index\.js["']/

export const exportedNames = (source) => {
  const names = new Set()
  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of match[1].split(",")) {
      const name = part
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)
        .pop()
      if (name) names.add(name)
    }
  }
  for (const match of source.matchAll(
    /export\s+(?:async\s+)?(?:const|let|function|type|class|interface|enum)\s+(\w+)/g,
  ))
    names.add(match[1])
  return [...names]
}

const sourceFiles = (root) =>
  execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((file) => callerFolders.some((folder) => file.startsWith(folder)) && sourcePattern.test(file))
    .filter((file) => fs.existsSync(path.join(root, file)))

export const unusedExports = (root) => {
  const files = sourceFiles(root)
  const packages = files
    .filter((file) => /^packages\/[^/]+\/src\/index\.ts$/.test(file))
    .map((file) => file.slice(0, -"/src/index.ts".length))
    .sort()
  const unused = []
  for (const pkg of packages) {
    const callers = files
      .map((file) => ({ file, source: fs.readFileSync(path.join(root, file), "utf8") }))
      .filter(({ file, source }) => !file.startsWith(`${pkg}/`) || throughIndex.test(source))
      .map(({ source }) => source)
      .join("\n")
    const names = exportedNames(fs.readFileSync(path.join(root, pkg, "src/index.ts"), "utf8"))
    for (const name of names.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })))
      if (!new RegExp(`\\b${name}\\b`).test(callers)) unused.push(`${pkg}: ${name}`)
  }
  return unused
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const unused = unusedExports(root)
  if (unused.length > 0) {
    console.error(unused.join("\n"))
    console.error(
      `${unused.length} names leave a package's index.ts and nothing outside the package uses them. Stop exporting them.`,
    )
    process.exit(1)
  }
  console.log("every name a package exports has a caller outside it")
}
