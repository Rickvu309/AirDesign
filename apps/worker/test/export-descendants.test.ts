import { expect, it, vi } from "vitest"
import { mkdtemp, mkdir, cp, symlink, readFile, writeFile, rm, readdir } from "node:fs/promises"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { RemoteJournal } from "../src/remote-journal.ts"
import { randomUUID } from "node:crypto"
import os from "node:os"
import path from "node:path"
import { exportLimits } from "../../../packages/operations/src/export-failure.ts"

it.each(["container", "systemd"])("cleans detached processes on every %s export exit", async mode => {
  vi.stubEnv("AIRDESIGN_ISOLATION", mode)
  const root = await mkdtemp(path.join(os.homedir(), "tmp/export-descendants-"))
  const shadow = path.join(root, "shadow")
  const originalMemory = exportLimits.memoryBytes
  const survivors = new Set<number>()
  try {
    await mkdir(path.join(shadow, "apps/worker"), { recursive: true })
    await cp("apps/worker/src", path.join(shadow, "apps/worker/src"), { recursive: true })
    await symlink(path.resolve("packages"), path.join(shadow, "packages"))
    await symlink(path.resolve("node_modules"), path.join(shadow, "node_modules"))
    await writeFile(path.join(shadow, "package.json"), JSON.stringify({ type: "module" }))
    const entry = path.join(shadow, "apps/worker/src/export/entry.ts")
    const { deliverExport } = await import(path.join(shadow, "apps/worker/src/export/deliver.ts"))
    for (const action of ["normal", "cpu", "crash", "wall-clock", "memory", "cancellation"]) {
      const token = randomUUID()
      await writeFile(entry, `
        import {spawn,execFileSync} from "node:child_process"
        import {writeFileSync} from "node:fs"
        const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)",${JSON.stringify(token)}],{detached:true,stdio:"ignore"});child.unref()
        writeFileSync("descendant",String(child.pid))
        const action=${JSON.stringify(action)}
        if(action==="normal"){writeFileSync("result.bin","ok");writeFileSync("report.json","{}");process.exit(0)}
        if(action==="cpu"){execFileSync("prlimit",["--pid="+process.pid,"--cpu=1:2"]);for(;;)Math.sqrt(Math.random())}
        if(action==="crash")process.exit(7)
        const chunks=[]
        setInterval(()=>{if(action==="memory")chunks.push(Buffer.alloc(32*1024*1024,1))},20)
      `)
      const job = { id: randomUUID(), lease: randomUUID(), deadline: Date.now() + (action === "wall-clock" ? 2000 : 15000) }
      const directory = path.join(root, "jobs", job.id, job.lease)
      let failure: unknown
      exportLimits.memoryBytes = action === "memory" ? 192 * 1024 * 1024 : originalMemory
      const result = await deliverExport({
        claim: async () => job,
        active: async () => action !== "cancellation" || !(await readFile(path.join(directory, "descendant")).catch(() => null)),
        fail: async (_id: string, _lease: string, reason: unknown) => { failure = reason },
        complete: async () => true,
      }, path.join(root, "jobs"))
      if (action === "normal") expect(result?.committed).toBe(true)
      else if (["memory", "cpu", "wall-clock"].includes(action)) expect(failure).toMatchObject({ kind: "limit", limit: action })
      else if (action === "cancellation") expect(failure).toMatchObject({ kind: "application", code: "export-cancelled" })
      else expect(failure).toMatchObject({ kind: "exit", code: 7 })
      for (const name of await readdir("/proc")) {
        if (!/^\d+$/.test(name)) continue
        const command = await readFile(`/proc/${name}/cmdline`, "utf8").catch(() => "")
        if (command.split("\0").includes(token)) survivors.add(Number(name))
      }
      expect([...survivors]).toEqual([])
    }
  } finally {
    for (const pid of survivors) try { process.kill(pid, "SIGKILL") } catch {}
    exportLimits.memoryBytes = originalMemory
    vi.unstubAllEnvs()
    await rm(root, { recursive: true, force: true })
  }
}, 45000)

it("recovers a crashed systemd runner and kills its detached descendants", async () => {
  const root = await mkdtemp(path.join(os.homedir(), "tmp/export-scope-recovery-"))
  const directory = path.join(root, "job")
  await mkdir(directory)
  const unit = `airdesign-test-${randomUUID()}.scope`
  const runner = spawn("systemd-run", ["--user", "--scope", "--quiet", `--unit=${unit}`, process.execPath, new URL("./fixtures/detached-job.ts", import.meta.url).pathname], { stdio: "ignore", env: { ...process.env, AIRDESIGN_JOB_DIRECTORY: directory } })
  const exit = once(runner, "exit")
  const journal = new RemoteJournal(root)
  const job = { id: randomUUID(), lease: randomUUID(), queue: "export" as const, database: null, directory, unit, pid: null, identity: null, mode: "systemd" as const }
  journal.save(job)
  let pid = 0
  try {
    await expect.poll(async () => {
      pid = Number(await readFile(path.join(directory, "descendant"), "utf8").catch(() => "0"))
      return pid > 0
    }).toBe(true)
    runner.kill("SIGKILL")
    await exit
    await journal.clean(job)
    const stat = await readFile(`/proc/${pid}/stat`, "utf8").catch(() => "")
    expect(stat === "" || stat.split(") ")[1]?.startsWith("Z")).toBe(true)
  } finally {
    runner.kill("SIGKILL")
    await journal.clean(job)
    journal.close()
    await rm(root, { recursive: true, force: true })
  }
})
