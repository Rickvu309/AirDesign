import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { handKeptMessage, handKeptReferences, references, workspaceRoot } from "./reference-order.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-references-"))
const project = (folder, compilerOptions) => {
  fs.mkdirSync(path.join(root, folder, "src"), { recursive: true })
  if (compilerOptions !== undefined) {
    fs.writeFileSync(path.join(root, folder, "tsconfig.json"), JSON.stringify({ compilerOptions }))
  }
}

try {
  fs.writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n  - packages/*\n")
  project("packages/zeta", { composite: true })
  project("packages/alpha", { composite: true })
  project("packages/plain", {})
  project("packages/bare", undefined)
  project("apps/api", { composite: true })
  project("apps/web", { noEmit: true })
  project("tooling/fixture", { composite: true })
  fs.writeFileSync(path.join(root, "packages", "notes.txt"), "")

  same("every composite project under apps and packages, sorted", references(root), [
    "./apps/api",
    "./packages/alpha",
    "./packages/zeta",
  ])
  project("packages/beta", { composite: true })
  same("a new package is referenced with no list to edit", references(root), [
    "./apps/api",
    "./packages/alpha",
    "./packages/beta",
    "./packages/zeta",
  ])
  same("a workspace with neither folder has none", references(path.join(root, "packages", "bare")), [])
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
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
