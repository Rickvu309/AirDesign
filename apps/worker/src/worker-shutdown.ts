export const workerShutdownDeadlineMs = 2000

export function workerShutdown(stopChild?: (signal: NodeJS.Signals) => void) {
  const controller = new AbortController()
  let deadline: ReturnType<typeof setTimeout> | undefined
  let stoppedAt: number | undefined
  const stop = (signal: NodeJS.Signals) => {
    if (controller.signal.aborted) return
    stoppedAt = performance.now()
    process.stdout.write(JSON.stringify({ event: "worker-shutdown-started", signal, pid: process.pid }) + "\n")
    controller.abort()
    deadline = setTimeout(() => {
      process.stderr.write(`worker-shutdown-deadline-exceeded:${workerShutdownDeadlineMs}ms\n`)
      process.exit(1)
    }, workerShutdownDeadlineMs)
    stopChild?.(signal)
  }
  const terminate = () => stop("SIGTERM")
  const interrupt = () => stop("SIGINT")
  process.on("SIGTERM", terminate)
  process.on("SIGINT", interrupt)
  return {
    signal: controller.signal,
    close() {
      clearTimeout(deadline)
      if (stoppedAt !== undefined) process.stdout.write(JSON.stringify({ event: "worker-shutdown-complete", pid: process.pid, elapsedMs: Math.round(performance.now() - stoppedAt) }) + "\n")
      process.removeListener("SIGTERM", terminate)
      process.removeListener("SIGINT", interrupt)
    },
  }
}

export function isWorkerShutdown(error: unknown, signal: AbortSignal) {
  return signal.aborted && error instanceof Error && error.name === "AbortError"
}
