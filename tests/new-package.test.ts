import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const generator = path.join(repoRoot, "scripts/new-package.mjs")
const tsc = path.join(repoRoot, "node_modules/typescript/bin/tsc")

function run(args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    return { status: 0, stdout, stderr: "" }
  } catch (error) {
    const failed = error as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer }
    return {
      status: failed.status ?? 1,
      stdout: String(failed.stdout ?? ""),
      stderr: String(failed.stderr ?? ""),
    }
  }
}

function writeCopy(dir: string): void {
  for (const fileName of ["pnpm-workspace.yaml", "tsconfig.base.json", ".oxfmtrc.json"]) {
    writeFileSync(path.join(dir, fileName), readFileSync(path.join(repoRoot, fileName)))
  }
  writeFileSync(
    path.join(dir, "tsconfig.json"),
    `${JSON.stringify({ files: [], references: [{ path: "./packages/document" }] }, null, 2)}\n`,
  )
}

describe("new:package", () => {
  it("creates a package that typechecks and rejects a deep import", { timeout: 60_000 }, () => {
    const dir = mkdtempSync(path.join(tmpdir(), "airdesign-new-package-"))
    try {
      writeCopy(dir)
      const created = run([generator, "probe"], dir)
      expect(created.status).toBe(0)

      const packageJson = JSON.parse(readFileSync(path.join(dir, "packages/probe/package.json"), "utf8"))
      expect(packageJson.name).toBe("@airdesign/probe")
      expect(Object.keys(packageJson.exports)).toEqual(["."])
      const rootTsconfig = JSON.parse(readFileSync(path.join(dir, "tsconfig.json"), "utf8"))
      expect(rootTsconfig.references.map((item: { path: string }) => item.path)).toContain("./packages/probe")

      const typecheck = run([tsc, "-b", "packages/probe", "--pretty", "false"], dir)
      expect(typecheck.status, `${typecheck.stdout}\n${typecheck.stderr}`).toBe(0)

      const consumer = path.join(dir, "consumer")
      mkdirSync(path.join(dir, "node_modules/@airdesign"), { recursive: true })
      symlinkSync(path.join(dir, "packages/probe"), path.join(dir, "node_modules/@airdesign/probe"))
      mkdirSync(consumer)
      writeFileSync(path.join(consumer, "package.json"), '{"private":true,"type":"module"}\n')
      const consumerTsconfig = {
        extends: "../tsconfig.base.json",
        compilerOptions: {
          lib: ["es2023"],
          types: [],
          noEmit: true,
        },
      }
      writeFileSync(
        path.join(consumer, "public.ts"),
        'import { packageId } from "@airdesign/probe"\n\nexport const id = packageId()\n',
      )
      writeFileSync(
        path.join(consumer, "deep.ts"),
        'import { packageId } from "@airdesign/probe/src/index.js"\n\nexport const id = packageId()\n',
      )
      writeFileSync(
        path.join(consumer, "public.json"),
        `${JSON.stringify({ ...consumerTsconfig, files: ["public.ts"] }, null, 2)}\n`,
      )
      writeFileSync(
        path.join(consumer, "deep.json"),
        `${JSON.stringify({ ...consumerTsconfig, files: ["deep.ts"] }, null, 2)}\n`,
      )

      const publicImport = run([tsc, "-p", "consumer/public.json", "--pretty", "false"], dir)
      expect(publicImport.status, `${publicImport.stdout}\n${publicImport.stderr}`).toBe(0)

      const deepImport = run([tsc, "-p", "consumer/deep.json", "--pretty", "false"], dir)
      expect(deepImport.status).not.toBe(0)
      expect(`${deepImport.stdout}\n${deepImport.stderr}`).toContain("TS2307")

      const before = readFileSync(path.join(dir, "tsconfig.json"), "utf8")
      const source = readFileSync(path.join(dir, "packages/probe/src/index.ts"), "utf8")
      const again = run([generator, "probe"], dir)
      expect(again.status).not.toBe(0)
      expect(readFileSync(path.join(dir, "tsconfig.json"), "utf8")).toBe(before)
      expect(readFileSync(path.join(dir, "packages/probe/src/index.ts"), "utf8")).toBe(source)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("inserts a package among the references in path order", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "airdesign-new-package-order-"))
    try {
      writeCopy(dir)
      writeFileSync(
        path.join(dir, "tsconfig.json"),
        `${JSON.stringify({ files: [], references: [{ path: "./packages/theme" }] }, null, 2)}\n`,
      )
      const created = run([generator, "probe"], dir)
      expect(created.status, `${created.stdout}\n${created.stderr}`).toBe(0)
      const rootTsconfig = JSON.parse(readFileSync(path.join(dir, "tsconfig.json"), "utf8"))
      expect(rootTsconfig.references.map((item: { path: string }) => item.path)).toEqual([
        "./packages/probe",
        "./packages/theme",
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("fails an unsorted reference list and says to sort it by path", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "airdesign-reference-order-"))
    const checker = path.join(repoRoot, "scripts/reference-order.mjs")
    try {
      writeCopy(dir)
      writeFileSync(
        path.join(dir, "tsconfig.json"),
        `${JSON.stringify(
          { files: [], references: [{ path: "./packages/theme" }, { path: "./packages/document" }] },
          null,
          2,
        )}\n`,
      )
      const unsorted = run([checker], dir)
      expect(unsorted.status).not.toBe(0)
      expect(unsorted.stderr).toContain("Sort the references in tsconfig.json by path.")

      writeFileSync(
        path.join(dir, "tsconfig.json"),
        `${JSON.stringify(
          { files: [], references: [{ path: "./packages/document" }, { path: "./packages/theme" }] },
          null,
          2,
        )}\n`,
      )
      const sorted = run([checker], dir)
      expect(sorted.status, `${sorted.stdout}\n${sorted.stderr}`).toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
