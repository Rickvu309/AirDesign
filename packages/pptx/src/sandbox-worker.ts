export const rssCapBytes = 512 * 1024 * 1024

export type SandboxProcess = {
  readonly rss: () => number
  readonly kill: () => void
}

export type SandboxResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: "rss" }

function processAt(processes: readonly SandboxProcess[], child: number): SandboxProcess {
  if (!Number.isInteger(child) || child < 0) throw new Error("process")
  const found = processes[child]
  if (found === undefined) throw new Error("process")
  return found
}

function overCap(child: SandboxProcess, cap: number): boolean {
  return child.rss() > cap
}

export async function runSandboxed<T>(
  processes: readonly SandboxProcess[],
  child: number,
  job: () => Promise<T>,
  cap: number = rssCapBytes,
): Promise<SandboxResult<T>> {
  const target = processAt(processes, child)
  if (overCap(target, cap)) {
    target.kill()
    return { ok: false, reason: "rss" }
  }
  const value = await job()
  if (overCap(target, cap)) {
    target.kill()
    return { ok: false, reason: "rss" }
  }
  return { ok: true, value }
}
