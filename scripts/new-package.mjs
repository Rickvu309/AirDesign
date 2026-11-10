import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const name = process.argv[2]

if (process.argv.length !== 3 || !namePattern.test(name)) {
  console.error("usage: pnpm new:package <name>")
  process.exit(1)
}

function workspaceRoot(start) {
  let dir = path.resolve(start)
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) {
      console.error("pnpm-workspace.yaml not found")
      process.exit(1)
    }
    dir = parent
  }
}

const root = workspaceRoot(process.cwd())
const packageDir = path.join(root, "packages", name)

if (existsSync(packageDir)) {
  console.error(`package ${name} already exists`)
  process.exit(1)
}

const packageName = `@airdesign/${name}`
const packageJsonPath = path.join(packageDir, "package.json")
const packageTsconfigPath = path.join(packageDir, "tsconfig.json")
const sourcePath = path.join(packageDir, "src", "index.ts")

mkdirSync(path.dirname(sourcePath), { recursive: true })

writeFileSync(
  packageJsonPath,
  `${JSON.stringify(
    {
      name: packageName,
      version: "0.0.0",
      private: true,
      type: "module",
      exports: {
        ".": {
          types: "./dist/index.d.ts",
          import: "./dist/index.js",
        },
      },
      files: ["dist"],
      scripts: {
        build: "tsc -b",
        lint: "oxlint",
        typecheck: "tsc -b",
      },
      devDependencies: {
        oxlint: "^1.90.0",
        typescript: "catalog:",
      },
    },
    null,
    2,
  )}\n`,
)

writeFileSync(
  packageTsconfigPath,
  `${JSON.stringify(
    {
      extends: "../../tsconfig.base.json",
      compilerOptions: {
        composite: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        lib: ["es2023"],
        types: [],
        rootDir: "src",
        outDir: "dist",
        tsBuildInfoFile: "./dist/tsconfig.tsbuildinfo",
      },
      include: ["src"],
    },
    null,
    2,
  )}\n`,
)

writeFileSync(sourcePath, `export function packageId(): string {\n  return "${packageName}"\n}\n`)

const oxfmt = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../node_modules/.bin/oxfmt")
const formatted = spawnSync(oxfmt, ["--write", packageJsonPath, packageTsconfigPath, sourcePath], {
  cwd: root,
  encoding: "utf8",
})

if (formatted.status !== 0) {
  if (formatted.stdout) {
    process.stdout.write(formatted.stdout)
  }
  if (formatted.stderr) {
    process.stderr.write(formatted.stderr)
  }
  process.exit(formatted.status ?? 1)
}

console.log(`created ${packageName}`)
