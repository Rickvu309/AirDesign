export const workerShutdownDeadlineMs = 2000

export function workerShutdown(stopChild?: (signal: NodeJS.Signals) => void) {
  const controller = new AbortController()
  let deadline: ReturnType<typeof setTimeout> | undefined
  const stop = (signal: NodeJS.Signals) => {
    if (controller.signal.aborted) return
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
      process.removeListener("SIGTERM", terminate)
      process.removeListener("SIGINT", interrupt)
    },
  }
}

export function isWorkerShutdown(error: unknown, signal: AbortSignal) {
  return signal.aborted && error instanceof Error && error.name === "AbortError"
}
