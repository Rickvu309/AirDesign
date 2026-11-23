import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript-api"
import { comparePaths, referenceFolders, workspaceRoot } from "./reference-order.mjs"

export const typescriptFile = /\.(?:ts|tsx|mts|cts)$/
export const projectConfig = /(?:^|\/)tsconfig[^/]*\.json$/

export const typecheckProjects = (root) => [
  ".",
  ...referenceFolders
    .flatMap((folder) => {
      const parent = path.join(root, folder)
      if (!existsSync(parent)) return []
      return readdirSync(parent, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `./${folder}/${entry.name}`)
    })
    .filter((project) => existsSync(path.join(root, project, "tsconfig.json")))
    .sort(comparePaths),
]

const parseHost = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} }

const configFileOf = (location) =>
  existsSync(location) && statSync(location).isDirectory() ? path.join(location, "tsconfig.json") : location

const reach = (root) => {
  const configs = new Set()
  const files = new Set()
  const visit = (location) => {
    const config = configFileOf(location)
    if (configs.has(config) || !existsSync(config)) return
    configs.add(config)
    const parsed = ts.getParsedCommandLineOfConfigFile(config, {}, parseHost)
    if (parsed === undefined) return
    for (const extended of parsed.options.configFile?.extendedSourceFiles ?? []) configs.add(path.resolve(extended))
    for (const file of parsed.fileNames) files.add(path.resolve(file))
    for (const reference of parsed.projectReferences ?? []) visit(reference.path)
  }
  for (const project of typecheckProjects(root)) visit(path.join(root, project))
  return { configs, files }
}

const failsOnPurpose = (root, file) => existsSync(path.join(root, path.dirname(file), "expect.json"))

export const leftOut = (root, tracked) => {
  const { configs, files } = reach(root)
  const outside = (file, reached) => !reached.has(path.join(root, file)) && !failsOnPurpose(root, file)
  return [
    ...tracked
      .filter((file) => projectConfig.test(file) && outside(file, configs))
      .map((file) => `${file} is a project pnpm typecheck never builds.`),
    ...tracked
      .filter((file) => typescriptFile.test(file) && outside(file, files))
      .map((file) => `${file} is in no project pnpm typecheck builds.`),
  ]
}

export const trackedFiles = (root) =>
  spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 2 ** 20 })
    .stdout.split("\0")
    .filter((file) => file !== "")

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = workspaceRoot(path.dirname(fileURLToPath(import.meta.url)))
  const missed = leftOut(root, trackedFiles(root))
  if (missed.length > 0) {
    console.error(
      `${missed.join("\n")}\nGive it a tsconfig.json under apps/ or packages/, or add it to the include of the root tsconfig.json.`,
    )
    process.exit(1)
  }
  const tsc = path.join(root, "node_modules", ".bin", "tsc")
  const built = spawnSync(tsc, ["-b", ...typecheckProjects(root), ...process.argv.slice(2)], {
    cwd: root,
    stdio: "inherit",
  })
  process.exit(built.status ?? 1)
}
