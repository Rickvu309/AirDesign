const signals = ["SIGINT", "SIGTERM", "SIGHUP"]

export function listenForInterrupt(onInterrupt) {
  let interrupted = false
  const handler = (signal) => {
    if (interrupted) {
      process.stderr.write(`ignored ${signal}: cleanup is in progress\n`)
      return
    }
    interrupted = true
    onInterrupt(signal)
  }
  for (const signal of signals) process.on(signal, handler)
  return () => {
    for (const signal of signals) process.off(signal, handler)
  }
}
