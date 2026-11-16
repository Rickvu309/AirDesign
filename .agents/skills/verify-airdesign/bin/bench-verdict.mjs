export const sides = ["main", "branch"]
export const shownShare = 0.05

export const quantile = (sorted, share) => {
  const at = (sorted.length - 1) * share
  const low = Math.floor(at)
  const high = Math.ceil(at)
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low)
}

export const summary = (ms) => {
  const sorted = [...ms].sort((left, right) => left - right)
  return {
    ms,
    median: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    spread: [quantile(sorted, 0.25), quantile(sorted, 0.75)],
  }
}

const range = ({ spread }) => spread[1] - spread[0]

export const verdict = (main, branch) => {
  const by = branch.median - main.median
  const share = Math.round((Math.abs(by) / main.median) * 1000) / 1000
  const shown = Math.abs(by) > Math.max(range(main), range(branch)) && Math.abs(by) > shownShare * main.median
  if (!shown) return { verdict: "no difference shown", by, share }
  return { verdict: by > 0 ? "slower" : "faster", by: Math.abs(by), share }
}

export const schedule = (cases, runs) =>
  Array.from({ length: runs }, (_, at) =>
    cases.flatMap((name) => sides.map((side) => ({ run: at + 1, case: name, side }))),
  ).flat()

const unitOf = (ms) => {
  if (ms >= 1000) return { scale: 1000, digits: 2, unit: "s" }
  if (ms >= 100) return { scale: 1, digits: 0, unit: "ms" }
  return { scale: 1, digits: 1, unit: "ms" }
}

const shown = (value, { scale, digits }) => (value / scale).toFixed(digits)

const timed = ({ median, spread }) => {
  const unit = unitOf(median)
  return `${shown(median, unit)} ${unit.unit} [${shown(spread[0], unit)}-${shown(spread[1], unit)}]`
}

const said = (row) => {
  if (row.verdict === "no difference shown") return row.verdict
  const unit = unitOf(row.main.median)
  return `${row.verdict} by ${shown(row.by, unit)} ${unit.unit} (${String(Math.round(row.share * 100))} %)`
}

export const benchTable = ({ base, head, throttle, runs, rows, load }) => {
  const width = Math.max(...rows.map((row) => row.case.length), 8) + 3
  const line = (name, main, branch, last) => `${name.padEnd(width)}${main.padEnd(21)}${branch.padEnd(21)}${last}`
  const above =
    load.above === 0 ? "" : ` (${String(load.above)} run${load.above === 1 ? "" : "s"} above the core count)`
  return [
    `bench ${base.slice(0, 8)} (main) vs ${head.slice(0, 8)}, CPU throttle ${String(throttle)}, ${String(runs)} runs a side, interleaved`,
    line("case", "main median [IQR]", "branch median [IQR]", "verdict"),
    ...rows.map((row) => line(row.case, timed(row.main), timed(row.branch), said(row))),
    `load max ${String(load.max)} on ${String(load.cores)} cores${above}`,
  ].join("\n")
}
