import { readdir, readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const fixturesDir = path.join(root, "tooling/boundary-fixtures")
const tsc = path.join(root, "node_modules/typescript/bin/tsc")

const names = (await readdir(fixturesDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

if (names.length === 0) {
  console.error("no boundary fixtures")
  process.exit(1)
}

let failed = false

for (const name of names) {
  const directory = path.join(fixturesDir, name)
  const expected = JSON.parse(await readFile(path.join(directory, "expect.json"), "utf8"))
  const code = expected.code
  const result = spawnSync(process.execPath, [tsc, "-p", directory, "--pretty", "false", "--noEmit"], {
    encoding: "utf8",
    cwd: root,
  })
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
  if (result.status === 0) {
    console.error(`${name}: compiled, expected ${code}`)
    failed = true
    continue
  }
  if (!new RegExp(`\\b${code}\\b`).test(output)) {
    console.error(`${name}: missing ${code}`)
    console.error(output.trim())
    failed = true
    continue
  }
  console.log(`${name}: ${code}`)
}

const specifierPattern = /\bfrom\s+["']([^"']+)["']|\bimport\s*(?:\(\s*)?["']([^"']+)["']/g

const packageName = (specifier) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]

const walkSources = async (directory, files) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await walkSources(full, files)
      continue
    }
    if (entry.name.includes(".test.") || entry.name.includes(".spec.")) continue
    if (/\.(?:ts|tsx|js|mjs|mts|astro)$/.test(entry.name)) files.push(full)
  }
}

const packagesDir = path.join(root, "packages")
for (const entry of (await readdir(packagesDir, { withFileTypes: true })).filter((item) => item.isDirectory())) {
  const packageDir = path.join(packagesDir, entry.name)
  const manifest = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8"))
  const declared = new Set(
    ["dependencies", "devDependencies", "peerDependencies"].flatMap((key) => Object.keys(manifest[key] ?? {})),
  )
  const files = []
  await walkSources(packageDir, files)
  for (const file of files) {
    const source = await readFile(file, "utf8")
    for (const match of source.matchAll(specifierPattern)) {
      const specifier = match[1] ?? match[2]
      const where = path.relative(root, file)
      if (specifier.startsWith(".")) {
        const relative = path.relative(packageDir, path.resolve(path.dirname(file), specifier))
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
          console.error(`${where} imports ${specifier}, which leaves the package`)
          failed = true
        }
        continue
      }
      if (specifier.includes(":")) continue
      const name = packageName(specifier)
      if (!declared.has(name)) {
        console.error(`${where} imports ${name}, which is not in its package.json`)
        failed = true
      }
    }
  }
}

if (failed) {
  process.exit(1)
}
