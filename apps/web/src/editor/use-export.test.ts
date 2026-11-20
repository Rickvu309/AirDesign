import { expect, it } from "vitest"
import { ExportStopped } from "@/export/export-deck"
import { PicturesUploading } from "@/picture-tool"
import { exportFailure, exportNotices } from "@/editor/use-export"

it("names why an export stopped, and offers the export again for each reason", () => {
  expect(exportFailure(new ExportStopped("file"))).toBe("export-file-missing")
  expect(exportFailure(new ExportStopped("edits"))).toBe("export-edits-unread")
  expect(exportFailure(new ExportStopped("write", { cause: new Error("rels") }))).toBe("export-edit-unwritten")
  expect(exportFailure(new PicturesUploading())).toBe("picture-uploading")
  expect(exportFailure(new Error("other"))).toBe("export-failed")
  for (const reason of ["file", "edits", "write"] as const)
    expect(exportNotices).toContain(exportFailure(new ExportStopped(reason)))
})
