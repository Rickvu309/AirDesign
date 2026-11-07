import { copy, fillCopy } from "@airdesign/ui"
import type { ExportFailure } from "../../../../packages/operations/src/export-failure.ts"

export function exportFailureMessage(failure: ExportFailure): string {
  switch (failure.kind) {
    case "limit":
      switch (failure.limit) {
        case "wall-clock": return copy("export.failed_time")
        case "memory": return copy("export.failed_memory")
        case "cpu": return copy("export.failed_cpu")
        case "file-size": return copy("export.failed_size")
      }
    case "signal": return fillCopy("export.failed_signal", { signal: failure.signal })
    case "exit": return fillCopy("export.failed_exit", { code: String(failure.code) })
    case "application": return copy("export.failed_application")
  }
}
