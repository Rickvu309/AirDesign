import { readFile, readdir, readlink, rm, stat } from "node:fs/promises"
import path from "node:path"

const clusterPrefix = "airdesign-api-"
const leftoverAgeMs = 60 * 60 * 1000

async function commandLine(pid: string): Promise<string> {
  return readFile(`/proc/${pid}/cmdline`, "utf8")
    .then((text) => text.split("\0").join(" "))
    .catch(() => "")
}

async function postmasterServes(dir: string): Promise<boolean> {
  const pid = await readFile(path.join(dir, "data/postmaster.pid"), "utf8")
    .then((text) => text.split("\n")[0]?.trim() ?? "")
    .catch(() => "")
  if (!/^\d+$/.test(pid)) return false
  return (await commandLine(pid)).includes(path.join(dir, "data"))
}

async function usedByAProcess(dirs: readonly string[]): Promise<Set<string>> {
  const used = new Set<string>()
  const entries = await readdir("/proc").catch(() => [])
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue
    const cwd = await readlink(`/proc/${entry}/cwd`).catch(() => "")
    const line = await commandLine(entry)
    for (const dir of dirs) {
      if (cwd === dir || cwd.startsWith(`${dir}/`) || line.includes(`${dir}/`) || line.includes(`${dir} `))
        used.add(dir)
    }
  }
  return used
}

export async function removeLeftoverClusters(root: string, now = Date.now()): Promise<string[]> {
  const names = await readdir(root).catch(() => [])
  const old: string[] = []
  for (const name of names) {
    if (!name.startsWith(clusterPrefix)) continue
    const dir = path.join(root, name)
    const made = await stat(dir).catch(() => undefined)
    if (made === undefined || !made.isDirectory() || now - made.mtimeMs < leftoverAgeMs) continue
    if (await postmasterServes(dir)) continue
    old.push(dir)
  }
  if (old.length === 0) return []
  const used = await usedByAProcess(old)
  const removed = old.filter((dir) => !used.has(dir))
  await Promise.all(removed.map((dir) => rm(dir, { recursive: true, force: true })))
  return removed
}
