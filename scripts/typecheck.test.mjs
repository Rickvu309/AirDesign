import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { leftOut, trackedFiles, typecheckProjects } from "./typecheck.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-typecheck-"))
const tracked = []
const write = (file, content) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), typeof content === "string" ? content : JSON.stringify(content))
  tracked.push(file)
}
const without = (file) => {
  fs.rmSync(path.join(root, file))
  tracked.splice(tracked.indexOf(file), 1)
}

try {
  write("pnpm-workspace.yaml", "packages:\n  - apps/*\n  - packages/*\n")
  write("tsconfig.base.json", { compilerOptions: { strict: true } })
  write("tsconfig.json", { extends: "./tsconfig.base.json", include: ["tests"] })
  write("tests/journey.test.ts", "export {}\n")
  write("packages/alpha/tsconfig.json", { extends: "../../tsconfig.base.json", compilerOptions: { composite: true } })
  write("packages/alpha/src/index.ts", "export {}\n")
  write("apps/web/tsconfig.json", { files: [], references: [{ path: "./tsconfig.app.json" }] })
  write("apps/web/tsconfig.app.json", { compilerOptions: { noEmit: true }, include: ["src"] })
  write("apps/web/src/main.tsx", "export {}\n")
  write("apps/site/tsconfig.json", { compilerOptions: { noEmit: true } })
  write("apps/site/src/page.ts", "export {}\n")
  write("tooling/boundary-fixtures/deep-import/tsconfig.json", { files: ["import-private.ts"] })
  write("tooling/boundary-fixtures/deep-import/import-private.ts", 'import "@fixture/alpha/src/index.js"\n')
  write("tooling/boundary-fixtures/deep-import/expect.json", { code: "TS2307" })

  same(
    "the root project and every project under apps and packages, composite or not, sorted",
    typecheckProjects(root),
    [".", "./apps/site", "./apps/web", "./packages/alpha"],
  )
  same(
    "every tsconfig and every TypeScript file is reached, through references and extends, except a fixture that must fail",
    leftOut(root, tracked),
    [],
  )

  write("apps/web/tsconfig.worker.json", { compilerOptions: { noEmit: true }, include: ["worker"] })
  write("apps/web/worker/forward.ts", "export {}\n")
  same("a tsconfig no reference reaches is left out, and so is its code", leftOut(root, tracked), [
    "apps/web/tsconfig.worker.json is a project pnpm typecheck never builds.",
    "apps/web/worker/forward.ts is in no project pnpm typecheck builds.",
  ])
  without("apps/web/tsconfig.worker.json")
  without("apps/web/worker/forward.ts")

  write("playwright.config.ts", "export {}\n")
  same("a file outside every project's include is left out", leftOut(root, tracked), [
    "playwright.config.ts is in no project pnpm typecheck builds.",
  ])
  without("playwright.config.ts")

  write("tooling/checker/tsconfig.json", { files: ["check.ts"] })
  write("tooling/checker/check.ts", "export {}\n")
  same("a tooling project is built like a package", typecheckProjects(root).includes("./tooling/checker"), true)
  same("so its tsconfig and files are reached", leftOut(root, tracked), [])

  const repo = path.resolve(import.meta.dirname, "..")
  same("in the repo, pnpm typecheck reaches every tsconfig and TypeScript file", leftOut(repo, trackedFiles(repo)), [])
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
