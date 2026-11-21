import { elementId, openRegister } from "@airdesign/document"
import { expect, it, vi } from "vitest"
import { ExportStopped } from "@/export/export-deck"
import { PicturesUploading } from "@/picture-tool"
import { exportFailure, exportNotices, useExport, type ExportingDeck } from "@/editor/use-export"
import { paintingAhead, personCommands } from "@/editor/painted-ahead"
import { recordsInFlight } from "@/undo-list"

const reads = vi.hoisted(() => [] as string[])

vi.mock("@/export/export-deck", async (actual) => ({
  ...(await actual<typeof import("@/export/export-deck")>()),
  exportDeck: async (_id: string, ready: Promise<void>) => {
    await ready
    reads.push("read the device")
  },
}))
it("names why an export stopped, and offers the export again for each reason", () => {
  expect(exportFailure(new ExportStopped("file"))).toBe("export-file-missing")
  expect(exportFailure(new ExportStopped("edits"))).toBe("export-edits-unread")
  expect(exportFailure(new ExportStopped("write", { cause: new Error("rels") }))).toBe("export-edit-unwritten")
  expect(exportFailure(new PicturesUploading())).toBe("picture-uploading")
  expect(exportFailure(new Error("other"))).toBe("export-failed")
  for (const reason of ["file", "edits", "write"] as const)
    expect(exportNotices).toContain(exportFailure(new ExportStopped(reason)))
})

it("reads the device for an export only once every edit the canvas shows ahead of it is written", async () => {
  const device = openRegister("", "deck")
  let shown = device
  const ahead = paintingAhead({
    shown: () => shown,
    keep: (register) => {
      shown = register
    },
    show: () => undefined,
  })
  const written = ahead.paint(personCommands(device, elementId("256.2"), "", { value: "https://example.com" }))
  const deck = {
    id: "deck",
    records: { current: recordsInFlight() },
    pictureTool: { store: {} },
    paint: { current: { fits: () => new Map(), rows: () => new Map() } },
    ahead,
    setFailure: () => undefined,
  } as unknown as ExportingDeck
  const exporting = useExport(deck).onExport()
  await new Promise((done) => setTimeout(done, 0))
  expect(reads).toEqual([])
  written()
  await exporting
  expect(reads).toEqual(["read the device"])
})
