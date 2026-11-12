import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 as text } from "./package-bytes.js"
import { routeHosts as hosts } from "./route-hosts.js"
import { routeRuns } from "./route-parts.js"

describe("routeRuns on tables", () => {
  it("does not remove the only row of a table", () => {
    const parts = hosts()
    const bytes = parts.get("ppt/slides/slide1.xml")
    if (bytes === undefined) throw new Error("part")
    parts.set(
      "ppt/slides/slide1.xml",
      text(decodeUtf8(bytes).replace(`<a:tr h="2"><a:tc><a:t>B</a:t></a:tc></a:tr>`, "")),
    )
    const runs = routeRuns(parts)
    const operations = runs.map((run) => run.operation)
    expect(operations).toContain("tbl.addRow")
    expect(operations).not.toContain("tbl.removeRow")
    expect(runs.filter((run) => run.operation.startsWith("tbl.") && run.error !== null)).toEqual([])
  })

  it("removes a row of a table that has two, not the last row of the slide", () => {
    const parts = hosts()
    const bytes = parts.get("ppt/slides/slide1.xml")
    if (bytes === undefined) throw new Error("part")
    const lone = `<a:tbl><a:tr h="3"><a:tc><a:t>C</a:t></a:tc></a:tr></a:tbl>`
    parts.set("ppt/slides/slide1.xml", text(decodeUtf8(bytes).replace("</p:spTree>", `${lone}</p:spTree>`)))
    const run = routeRuns(parts).find((item) => item.operation === "tbl.removeRow")
    expect(run?.error).toBeNull()
  })
})
