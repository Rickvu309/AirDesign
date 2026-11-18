import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(process.argv[2] ?? ".")
const temporary = mkdtempSync(path.join(os.tmpdir(), "browser-imports-config-"))
const config = path.join(temporary, "tsconfig.json")
const compiler = fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url))
const importErrors = new Set([1192, 2305, 2306, 2307, 2459, 2498, 2613, 2614, 2724])
try {
  for (const folder of ["apps", "packages"]) {
    const parent = path.join(root, folder)
    if (!existsSync(parent)) continue
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      const source = path.join(parent, entry.name, "src")
      if (!entry.isDirectory() || !existsSync(source)) continue
      const target = path.join(temporary, folder, entry.name)
      mkdirSync(target, { recursive: true })
      symlinkSync(source, path.join(target, "dist"), "dir")
    }
  }
  writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: {
        rootDirs: [root, temporary],
        noEmit: true,
        allowJs: true,
        checkJs: true,
        allowImportingTsExtensions: true,
        skipLibCheck: true,
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        paths: { "@airdesign/*": [path.join(root, "packages/*/src/index.ts")] },
      },
      include: ["tests/browser/**/*", ".agents/skills/verify-airdesign/**/*"].map((folder) => path.join(root, folder)),
    }),
  )
  const checked = spawnSync(process.execPath, [compiler, "--project", config, "--pretty", "false"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 16 * 2 ** 20,
  })
  if (
    checked.error ||
    checked.signal ||
    ![0, 1, 2].includes(checked.status) ||
    (checked.status !== 0 && !/error TS\d+:/.test(checked.stdout))
  ) {
    throw new Error(checked.error?.message ?? `${checked.stdout}${checked.stderr}`)
  }
  const failures = checked.stdout.split("\n").filter((line) => {
    const diagnostic = line.match(/^(.+)\(\d+,\d+\): error TS(\d+):/)
    if (!diagnostic) return /^error TS/.test(line)
    return (
      importErrors.has(Number(diagnostic[2])) &&
      ["tests/browser/", ".agents/skills/verify-airdesign/"].some((folder) =>
        path.resolve(root, diagnostic[1]).startsWith(path.join(root, folder)),
      )
    )
  })
  if (failures.length > 0) {
    console.error(failures.join("\n"))
    process.exitCode = 1
  } else {
    console.log("test-imports: browser and verification import/export diagnostics passed")
  }
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
