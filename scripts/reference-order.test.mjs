import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { handKeptMessage, handKeptReferences, unbuiltDependencies, workspaceRoot } from "./reference-order.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-references-"))
const project = (folder, compilerOptions) => {
  fs.mkdirSync(path.join(root, folder, "src"), { recursive: true })
  fs.writeFileSync(path.join(root, folder, "tsconfig.json"), JSON.stringify({ compilerOptions }))
}

try {
  fs.writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n  - packages/*\n")
  project("packages/zeta", { composite: true })
  project("packages/alpha", { composite: true })
  project("packages/beta", { composite: true })
  project("apps/api", { composite: true })

  same("the root is found from a nested folder", workspaceRoot(path.join(root, "packages", "alpha", "src")), root)
  same("no workspace above has no root", workspaceRoot(path.parse(root).root), undefined)

  same("a root config with no references passes", handKeptReferences({ files: [] }), [])
  same(
    "a root config that lists references by hand fails",
    handKeptReferences({ files: [], references: [{ path: "./packages/alpha" }] }),
    [handKeptMessage],
  )
  same("even an empty hand list fails", handKeptReferences({ files: [], references: [] }), [handKeptMessage])
  same("the message names the command", handKeptMessage.includes("pnpm typecheck"), true)

  const depends = (folder, build, dependencies, referenced) => {
    fs.writeFileSync(
      path.join(root, folder, "package.json"),
      JSON.stringify({ scripts: { build }, dependencies: Object.fromEntries(dependencies.map((name) => [name, "x"])) }),
    )
    fs.writeFileSync(
      path.join(root, folder, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { composite: true }, references: referenced.map((item) => ({ path: item })) }),
    )
  }
  depends("packages/alpha", "tsc -b", [], [])
  depends("packages/zeta", "tsc -b", ["@fixture/alpha"], ["../alpha"])
  depends("apps/api", "tsc -b", ["@fixture/zeta", "@fixture/alpha", "left-pad"], ["../../packages/zeta"])
  same("a dependency built through another reference needs no line of its own", unbuiltDependencies(root), [])
  depends("apps/api", "tsc -b && vite build", ["@fixture/zeta", "@fixture/beta"], ["../../packages/zeta"])
  same(
    "a project tsc -b builds must reference each workspace package it depends on, or a fresh checkout cannot build it",
    unbuiltDependencies(root),
    ['apps/api depends on packages/beta but no tsconfig reference builds it. Add { "path": "../../packages/beta" }.'],
  )
  depends("apps/api", "astro build", ["@fixture/beta"], [])
  same("a project another tool builds is left alone", unbuiltDependencies(root), [])
  same(
    "in the repo, every project tsc -b builds reaches each workspace package it depends on",
    unbuiltDependencies(path.resolve(import.meta.dirname, "..")),
    [],
  )
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
