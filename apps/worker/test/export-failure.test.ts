import { expect, it } from "vitest"
import { decodeExportFailure, type ExportFailure } from "../../../packages/operations/src/export-failure.ts"

it("preserves a lost subreaper reason across the persisted failure boundary", () => {
  const failure: ExportFailure = { kind: "isolation", reason: "subreaper-lost" }
  expect(decodeExportFailure(JSON.stringify(failure))).toEqual(failure)
  expect(decodeExportFailure(JSON.stringify({ kind: "isolation", reason: "unknown" }))).toMatchObject({ kind: "application" })
})
