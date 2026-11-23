import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildPathFaults, packageExports, packageReadFaults, readFaults } from "./package-reads.mjs"
import { packageBuild } from "./package-build.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const exportsOf = packageExports(root)

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

same(
  "replaying look/doom-deck.mjs before 59690055a names the build it reached into by path",
  buildPathFaults(
    ".agents/skills/verify-airdesign/look/doom-deck.mjs",
    "  const { orderKeyBetween } = await import(pathToFileURL(`${kit.repo}/packages/document/dist/index.js`).href)",
  ).length,
  1,
)

same(
  "the same read through the loader names the package that no longer exports it, as Doom's move to its own package left it",
  readFaults(
    "look/doom-deck.mjs",
    'const { orderKeyBetween } = await packageBuild(kit.repo, "@airdesign/document")',
    exportsOf,
  ),
  [
    "look/doom-deck.mjs:1: @airdesign/document's src/index.ts does not export orderKeyBetween. Load the file that exports it now.",
  ],
)

same(
  "replaying bench/doom.mjs before 59690055a through the loader names the namespace document no longer exports",
  readFaults("bench/doom.mjs", 'const { doom } = await packageBuild(kit.repo, "@airdesign/document")', exportsOf)
    .length,
  1,
)

same(
  "a function read off a loaded package by name is checked too, as bench/doom-deck.mjs reads Doom",
  readFaults(
    "bench/doom-deck.mjs",
    'const doom = await packageBuild(kit.repo, "@airdesign/document")\nconst fold = doom.readFold(json)\n',
    exportsOf,
  ),
  [
    "bench/doom-deck.mjs:2: @airdesign/document's src/index.ts does not export readFold. Load the file that exports it now.",
  ],
)

same(
  "replaying PR 475's fixture through the loader names prepareMarkup, which the PowerPoint package does not export",
  readFaults("fixture-slides.mjs", 'const { prepareMarkup } = await packageBuild(root, "@airdesign/pptx")', exportsOf)
    .length,
  1,
)

same(
  "replaying serve.mjs before 69a81a8e0 through the loader names the api file the packs moved",
  readFaults(
    "serve.mjs",
    'const { startEmptyCluster } = await packageBuild(repo, "@airdesign/api", "postgres-setup.js")',
    exportsOf,
  ),
  [
    "serve.mjs:1: @airdesign/api's src/postgres-setup.ts does not exist. Load the file that holds startEmptyCluster now.",
  ],
)

same(
  "reads the packages export now pass",
  readFaults(
    "serve.mjs",
    'const { startEmptyCluster } = await packageBuild(repo, "@airdesign/api", "testing/postgres-setup.js")\nconst doom = await packageBuild(repo, "@airdesign/doom")\ndoom.readFold(json)\n',
    exportsOf,
  ),
  [],
)

same("a type export is not a runtime read", exportsOf("@airdesign/doom").has("NodeId"), false)

same(
  "no file outside the loader reaches into a build by its path or reads a name its package lacks",
  packageReadFaults(root),
  [],
)

let refused
try {
  await packageBuild(root, "@airdesign/nothing")
} catch (error) {
  refused = error.message
}
same(
  "an unknown package name is refused by name",
  refused,
  "No package in apps or packages is named @airdesign/nothing.",
)

same(
  "replaying the loader deck-diff.mjs and metrics.mjs kept for themselves names the build file they joined by hand",
  buildPathFaults("scripts/deck-diff.mjs", '  const entry = path.join(root, "packages", name, "dist/index.js")').length,
  1,
)
