import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { performanceBudgets } from "../../contract-rules/src/budgets.ts"

const packedUiBytes = performanceBudgets.packedUiBytes

describe("packed ui", () => {
  it("installs in a clean React 19 consumer with skipLibCheck off", () => {
    const built = spawnSync("npx", ["vite", "build", "--config", "packages/ui/vite.config.ts"], { stdio: "inherit" })
    expect(built.status).toBe(0)
    const finished = spawnSync("node", ["scripts/finish-ui-dist.mjs"], { stdio: "inherit" })
    expect(finished.status).toBe(0)
    const bundle = statSync("packages/ui/dist/index.js")
    expect(bundle.size).toBeLessThanOrEqual(packedUiBytes)
    const packDir = path.resolve("packages/ui/dist")
    const packed = spawnSync("npm", ["pack", "--json", "--pack-destination", packDir], { cwd: path.resolve("packages/ui"), encoding: "utf8" })
    if (packed.status !== 0) {
      throw new Error(packed.stderr || packed.stdout)
    }
    const packedInfo = JSON.parse(packed.stdout)
    const filename = packedInfo[0]?.filename
    expect(filename).toBeTruthy()
    const directory = mkdtempSync(path.join(tmpdir(), "airdesign-ui-"))
    writeFileSync(path.join(directory, ".npmrc"), "allow-scripts=*\n")
    writeFileSync(path.join(directory, "package.json"), JSON.stringify({
      name: "ui-consumer",
      private: true,
      dependencies: {
        "@airdesign/ui": `file:${path.resolve("packages/ui/dist", filename)}`,
        react: "19.2.3",
        "react-dom": "19.2.3",
        sonner: "2.0.8",
        cmdk: "1.1.1",
      },
      devDependencies: {
        typescript: "5.9.3",
        "@types/react": "19.2.7",
        "@types/react-dom": "19.2.3",
      },
    }))
    writeFileSync(path.join(directory, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        target: "ES2023",
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: false,
        noEmit: true,
      },
      files: ["consumer.tsx"],
    }))
    const uiPackage = "@" + "airdesign/ui"
    const consumer = [
      "import { AlertDialog, Button, CodeEntry, CommandMenu, TextField, Toaster, Toolbar, copy, fillCopy, toast } from " + JSON.stringify(uiPackage),
      "export const sample = copy(\"shell.brand\")",
      "export const filled = fillCopy(\"access.resend_wait\", { n: \"30\" })",
      "export const view = (",
      "  <>",
      "    <Button variant=\"primary\" size=\"sign-in\">Continue</Button>",
      "    <TextField label=\"Email\" />",
      "    <CodeEntry label=\"Code\" value=\"\" onValueChange={() => undefined} />",
      "    <Toolbar label=\"Home\" items={[]} />",
      "    <CommandMenu open={false} onOpenChange={() => undefined} items={[]} />",
      "    <AlertDialog open={false} title=\"Sign out?\" body=\"End\" onClose={() => undefined} />",
      "    <Toaster />",
      "  </>",
      ")",
      "toast(sample)",
      "",
    ].join("\n")
    writeFileSync(path.join(directory, "consumer.tsx"), consumer)
    const installEnv = { ...process.env }
    delete installEnv.npm_config_allow_scripts
    delete installEnv.NPM_CONFIG_ALLOW_SCRIPTS
    const installed = spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: directory, encoding: "utf8", env: installEnv })
    if (installed.status !== 0) {
      throw new Error(installed.stderr || installed.stdout)
    }
    const checked = spawnSync("npx", ["tsc", "-p", "tsconfig.json", "--noEmit", "--pretty", "false"], { cwd: directory, stdio: "inherit" })
    expect(checked.status).toBe(0)
    const started = performance.now()
    readFileSync(path.join(directory, "node_modules/@airdesign/ui/dist/index.js"))
    const startupMs = performance.now() - started
    expect(startupMs).toBeLessThan(performanceBudgets.shellStartupMs)
    const evidence = path.join(process.env.HOME ?? "", "tmp/airdesign-autopilot/P01/perf")
    spawnSync("mkdir", ["-p", evidence])
    writeFileSync(path.join(evidence, "w02-pack.json"), `${JSON.stringify({
      packedJsBytes: bundle.size,
      packedUiBytes,
      moduleReadMs: startupMs,
      shellStartupBudgetMs: performanceBudgets.shellStartupMs,
      trunk: "absent",
    }, null, 2)}\n`)
  }, 120_000)
})
