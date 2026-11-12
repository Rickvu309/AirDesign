import os from "node:os"

export function load(cores = os.cpus().length, average = os.loadavg()) {
  return { oneMinute: Math.round(average[0] * 10) / 10, cores, busy: average[0] > cores }
}

export function loadLine(given = load()) {
  return `load ${String(given.oneMinute)} on ${String(given.cores)} cores${given.busy ? ", busy: rerun a failed step alone before you believe it" : ""}`
}
