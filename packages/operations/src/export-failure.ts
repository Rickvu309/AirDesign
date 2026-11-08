export const exportLimits = { wallMs: 60_000, cpuSeconds: 30, memoryBytes: 1024 * 1024 * 1024 }

export type ExportFailure =
  | { kind: "isolation"; reason: "subreaper-lost" }
  | { kind: "limit"; limit: "wall-clock" | "memory" | "cpu" | "file-size"; signal: string | null }
  | { kind: "signal"; signal: string }
  | { kind: "exit"; code: number; diagnostic: string }
  | { kind: "application"; code: string }

export function decodeExportFailure(reason: string): ExportFailure {
  try {
    const value: unknown = JSON.parse(reason)
    if (value && typeof value === "object" && "kind" in value) {
      if (value.kind === "isolation" && "reason" in value && value.reason === "subreaper-lost") return { kind: "isolation", reason: "subreaper-lost" }
      if (value.kind === "limit" && "limit" in value && (value.limit === "wall-clock" || value.limit === "memory" || value.limit === "cpu" || value.limit === "file-size") && "signal" in value && (value.signal === null || typeof value.signal === "string")) return { kind: "limit", limit: value.limit, signal: value.signal }
      if (value.kind === "signal" && "signal" in value && typeof value.signal === "string") return { kind: "signal", signal: value.signal }
      if (value.kind === "exit" && "code" in value && typeof value.code === "number" && "diagnostic" in value && typeof value.diagnostic === "string") return { kind: "exit", code: value.code, diagnostic: value.diagnostic }
      if (value.kind === "application" && "code" in value && typeof value.code === "string") return { kind: "application", code: value.code }
    }
  } catch {}
  return { kind: "application", code: reason }
}
