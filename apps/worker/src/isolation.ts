import { spawn } from "node:child_process"
import { mkdir, writeFile, readFile, rm, rmdir } from "node:fs/promises"
import path from "node:path"
import { OperationStore, type OperationId } from "../../../packages/operations/src/index.ts"

export async function deliver(store: OperationStore, id: OperationId, root: string, program: string): Promise<boolean> {
  const claimed = store.claim(id)
  if (!claimed) return false
  const directory = path.join(root, claimed.ownerDirectory, id, claimed.lease)
  const unit = `airdesign-${id}-${claimed.lease}.scope`
  let timer: ReturnType<typeof setTimeout> | undefined
  let killed: Promise<void> | undefined
  let cancellation: ReturnType<typeof setInterval> | undefined
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(path.join(directory, "input.pptx"), claimed.input, { mode: 0o600 })
    const repo = path.resolve(import.meta.dirname, "../../..")
    const child = spawn("systemd-run", ["--user", "--scope", "--quiet", `--unit=${unit}`, "-p", "MemoryMax=536870912", "-p", "MemorySwapMax=0", "-p", "CPUQuota=100%", "prlimit", "--cpu=25", "--fsize=524288000", "--nofile=128", "--", "bwrap", "--unshare-all", "--die-with-parent", "--new-session", "--ro-bind", "/usr", "/usr", "--ro-bind", "/lib", "/lib", "--ro-bind", repo, repo, "--bind", directory, "/job", "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--chdir", "/job", "--clearenv", "--setenv", "PATH", "/usr/bin", "/usr/bin/node", "--max-old-space-size=256", program], { stdio: ["ignore", "ignore", "pipe"] })
    let diagnostic = ""
    child.stderr.on("data", (value: Buffer) => { diagnostic = (diagnostic + value.toString()).slice(-2000) })
    const kill = () => {
      killed ??= new Promise<void>(resolve => {
        const killer = spawn("systemctl", ["--user", "kill", "--signal=SIGKILL", unit], { stdio: "ignore" })
        killer.once("exit", () => { child.kill("SIGKILL"); resolve() })
        killer.once("error", () => { child.kill("SIGKILL"); resolve() })
      })
    }
    timer = setTimeout(kill, 30_000)
    cancellation = setInterval(() => { if (!store.active(id, claimed.lease)) kill() }, 25)
    const code = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("exit", resolve) })
    if (code !== 0) {
      const failure = await readFile(path.join(directory,"failure.json")).catch(() => undefined)
      let reason = `isolated-worker-failed:${code}:${diagnostic.slice(-150)}`
      if (failure && failure.length <= 1024) {
        const value: unknown = JSON.parse(failure.toString())
        if (value && typeof value === "object" && "code" in value && typeof value.code === "string") reason = value.code.slice(0,200)
      }
      throw new Error(reason)
    }
    const result = await readFile(path.join(directory, "result.pptx"))
    const reportBytes = await readFile(path.join(directory, "report.json"))
    if (reportBytes.length > 8 * 1024 * 1024) throw new Error("report-limit")
    const report: unknown = JSON.parse(reportBytes.toString("utf8"))
    if (!report || typeof report !== "object" || Array.isArray(report)) throw new Error("invalid-worker-report")
    return store.complete(id, claimed.lease, result, Object.fromEntries(Object.entries(report)))
  } catch (error) {
    store.fail(id, claimed.lease, error instanceof Error ? error.message : "worker-failed")
    return false
  } finally {
    if (timer) clearTimeout(timer)
    if (cancellation) clearInterval(cancellation)
    await killed
    await rm(directory, { recursive: true, force: true })
    store.acknowledgeCleanup(id, claimed.lease)
    await rmdir(path.dirname(directory)).catch(() => undefined)
    await rmdir(path.dirname(path.dirname(directory))).catch(() => undefined)
  }
}
