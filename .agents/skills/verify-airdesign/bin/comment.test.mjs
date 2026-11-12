import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { agentHeader, agentOwner, comment, commentBody } from "./comment.mjs"

const folder = mkdtempSync(path.join(os.tmpdir(), "comment-"))
afterAll(() => rmSync(folder, { recursive: true, force: true }))

describe("comment", () => {
  it("formats comment with agent header on first line and takes name from one constant", () => {
    expect(agentOwner).toBe("Quan Vu")
    expect(agentHeader).toBe("🤖 **AI Agent responding on behalf of Quan Vu**")
    const formatted = commentBody("Review findings and notes.")
    const lines = formatted.split("\n")
    expect(lines[0]).toBe("🤖 **AI Agent responding on behalf of Quan Vu**")
    expect(lines[1]).toBe("")
    expect(lines.slice(2).join("\n")).toBe("Review findings and notes.")
  })

  it("refuses an empty file or whitespace only", () => {
    expect(() => commentBody("")).toThrow("refuses an empty file")
    expect(() => commentBody("   \n\n\t  ")).toThrow("refuses an empty file")
  })

  it("posts comment with gh pr comment", () => {
    const file = path.join(folder, "comment.md")
    writeFileSync(file, "LGTM, ready to merge.")
    const calls = []
    const mockGh = (args) => {
      calls.push(args)
      return "https://github.com/Rickvu309/AirDesign/pull/339#issuecomment-999"
    }

    const res = comment({ pr: 339, file, runGh: mockGh })
    expect(res.url).toBe("https://github.com/Rickvu309/AirDesign/pull/339#issuecomment-999")
    expect(calls.length).toBe(1)
    expect(calls[0][0]).toBe("pr")
    expect(calls[0][1]).toBe("comment")
    expect(calls[0][2]).toBe("339")
    expect(calls[0][3]).toBe("--body")
    expect(calls[0][4].startsWith("🤖 **AI Agent responding on behalf of Quan Vu**\n\n")).toBe(true)
  })
})
