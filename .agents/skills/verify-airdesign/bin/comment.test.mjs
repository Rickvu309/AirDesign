import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { comment, commentBody } from "./comment.mjs"

const folder = mkdtempSync(path.join(os.tmpdir(), "comment-"))
afterAll(() => rmSync(folder, { recursive: true, force: true }))

describe("comment", () => {
  it("posts the file's text as it is, with no agent line", () => {
    expect(commentBody("Review findings and notes.")).toBe("Review findings and notes.")
  })

  it("refuses a comment that carries an agent line", () => {
    expect(() => commentBody("🤖 **AI Agent responding on behalf of Quan Vu**\n\nLooks right.")).toThrow(
      'has the attribution line "🤖 **AI Agent responding on behalf of Quan Vu**". Delete that line.',
    )
    expect(() => commentBody("Looks right.\n\nReviewed with sol-loop: 1 rounds with gpt-6.2-sol.")).toThrow(
      "Delete that line.",
    )
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
    expect(calls[0][4]).toBe("LGTM, ready to merge.")
  })
})
