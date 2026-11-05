import { spawn, spawnSync } from "node:child_process"
import { createServer } from "node:http"
import { existsSync, mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { performanceBudgets } from "../../contract-rules/src/budgets.ts"

const packedUiBytes = performanceBudgets.packedUiBytes
const productionEnv = { ...process.env, NODE_ENV: "production" }

describe("packed ui", () => {
  it("installs in a clean React 19 consumer with skipLibCheck off", async () => {
    const built = spawnSync("npx", ["vite", "build", "--config", "packages/ui/vite.config.ts"], { stdio: "inherit", env: productionEnv })
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
    const readStarted = performance.now()
    readFileSync(path.join(directory, "node_modules/@airdesign/ui/dist/index.js"))
    const moduleReadMs = performance.now() - readStarted
    const browserStartupMs = await measurePackedShell(directory)
    expect(browserStartupMs).toBeLessThan(performanceBudgets.shellStartupMs)
    const evidence = path.join(process.env.HOME ?? "", "tmp/airdesign-autopilot/P01/perf")
    spawnSync("mkdir", ["-p", evidence])
    writeFileSync(path.join(evidence, "w02-pack.json"), `${JSON.stringify({
      packedJsBytes: bundle.size,
      packedUiBytes,
      moduleReadMs,
      browserStartupMs,
      shellStartupBudgetMs: performanceBudgets.shellStartupMs,
      workload: "packed-consumer-navigation-to-shell",
      sampleCount: 1,
      state: "cold-navigation",
      limiter: "browser-main-thread",
      trunk: "absent",
    }, null, 2)}\n`)
  }, 240_000)
})

function measurePackedShell(directory) {
  const viteLink = path.join(directory, "node_modules/vite")
  const pluginLink = path.join(directory, "node_modules/@vitejs")
  if (!existsSync(viteLink)) {
    symlinkSync(path.resolve("node_modules/vite"), viteLink)
  }
  if (!existsSync(pluginLink)) {
    symlinkSync(path.resolve("node_modules/@vitejs"), pluginLink)
  }
  writeFileSync(path.join(directory, "index.html"), [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head><meta charset=\"utf-8\" /><title>Shell</title></head>",
    "<body><div id=\"root\"></div><script type=\"module\" src=\"/shell.tsx\"></script></body>",
    "</html>",
    "",
  ].join("\n"))
  writeFileSync(path.join(directory, "shell.tsx"), [
    "import { useEffect } from \"react\"",
    "import { createRoot } from \"react-dom/client\"",
    "import { Button, copy } from \"@airdesign/ui\"",
    "import \"@airdesign/ui/tokens.css\"",
    "function Shell() {",
    "  useEffect(() => {",
    "    const shell = document.getElementById(\"shell\")",
    "    if (shell) shell.dataset.startupMs = String(Math.round(performance.now()))",
    "  }, [])",
    "  return <main id=\"shell\"><Button variant=\"primary\" size=\"sign-in\">{copy(\"shell.brand\")}</Button></main>",
    "}",
    "const root = document.getElementById(\"root\")",
    "if (root) createRoot(root).render(<Shell />)",
    "",
  ].join("\n"))
  writeFileSync(path.join(directory, "vite.shell.config.mjs"), [
    "import { defineConfig } from \"vite\"",
    "import react from \"@vitejs/plugin-react\"",
    "export default defineConfig({",
    "  plugins: [react()],",
    "  oxc: { jsx: { runtime: \"automatic\", development: false } },",
    "  build: { outDir: \"dist-shell\", emptyOutDir: true },",
    "})",
    "",
  ].join("\n"))
  const built = spawnSync("npx", ["vite", "build", "--config", "vite.shell.config.mjs"], { cwd: directory, encoding: "utf8", env: productionEnv })
  if (built.status !== 0) {
    throw new Error(built.stderr || built.stdout)
  }
  return serveAndReadStartup(path.join(directory, "dist-shell"))
}

function serveAndReadStartup(rootDir) {
  const hits = []
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1")
    const relative = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.replace(/^\/+/, "")
    const file = path.join(rootDir, relative)
    if (!file.startsWith(`${rootDir}${path.sep}`)) {
      hits.push(`403 ${requestUrl.pathname}`)
      response.writeHead(404)
      response.end()
      return
    }
    try {
      const body = readFileSync(file)
      hits.push(`200 ${requestUrl.pathname} ${body.length}`)
      response.writeHead(200, { "content-type": contentType(file) })
      response.end(body)
    } catch {
      hits.push(`404 ${requestUrl.pathname}`)
      response.writeHead(404)
      response.end()
    }
  })
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : 0
      const session = `p01-w02-${process.pid}`
      const browser = (args) => new Promise((resolveBrowser, rejectBrowser) => {
        const child = spawn("agent-browser", ["--session", session, ...args])
        let stdout = ""
        let stderr = ""
        child.stdout.setEncoding("utf8")
        child.stderr.setEncoding("utf8")
        child.stdout.on("data", (chunk) => { stdout += chunk })
        child.stderr.on("data", (chunk) => { stderr += chunk })
        child.on("close", (code) => {
          if (code !== 0) {
            rejectBrowser(new Error(`${args.join(" ")}\n${stdout}\n${stderr}`))
            return
          }
          resolveBrowser(stdout.trim())
        })
      })
      ;(async () => {
        try {
          await browser(["open", `http://127.0.0.1:${port}/`])
          try {
            await browser(["wait", "#shell"])
          } catch (error) {
            const errors = await browser(["errors"]).catch((pageError) => String(pageError))
            const text = await browser(["eval", "document.getElementById('root')?.innerHTML?.slice(0,200) ?? 'no-root'"]).catch((pageError) => String(pageError))
            const logs = await browser(["console"]).catch((pageError) => String(pageError))
            throw new Error(`${error}\n${errors}\n${logs}\n${hits.join("\n")}\n${text}`)
          }
          let startup = ""
          for (let attempt = 0; attempt < 20 && startup === ""; attempt += 1) {
            startup = String(await browser(["eval", "document.querySelector('#shell')?.dataset.startupMs ?? ''"])).replaceAll("\"", "")
            if (startup === "") {
              await browser(["wait", "100"])
            }
          }
          const browserStartupMs = Number(startup)
          if (!Number.isFinite(browserStartupMs)) {
            throw new Error(`startup-missing ${startup}`)
          }
          resolve(browserStartupMs)
        } catch (error) {
          reject(error)
        } finally {
          await browser(["close"]).catch(() => undefined)
          server.close()
        }
      })()
    })
  })
}

function contentType(file) {
  if (file.endsWith(".js")) {
    return "text/javascript"
  }
  if (file.endsWith(".css")) {
    return "text/css"
  }
  return "text/html"
}
