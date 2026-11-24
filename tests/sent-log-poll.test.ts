import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

export const pollsASentLog =
  /(?:expect\.poll|vi\.waitFor)\(\s*(?:async\s*)?\(\)\s*=>\s*(?:expect\()?\s*(?:server\.)?(?:sent|requests|fetched|fetches|posted)\b/

export function sentLogPolls(files: Record<string, string>): string[] {
  return Object.entries(files)
    .filter(([file, text]) => file !== "tests/sent-log-poll.test.ts" && pollsASentLog.test(text))
    .map(
      ([file]) =>
        `${file}: wait with answeringServer().drained(queue) from packages/live/src/testing/answering-server.ts`,
    )
}

function testFiles(): Record<string, string> {
  const listed = execFileSync("git", ["-C", repoRoot, "ls-files", "-z", "*.test.ts", "*.test.tsx", "*.spec.ts"], {
    encoding: "utf8",
  })
  return Object.fromEntries(
    listed
      .split("\0")
      .filter((file) => file !== "")
      .map((file) => [file, readFileSync(path.join(repoRoot, file), "utf8")]),
  )
}

describe("a test waits for a queue to drain, not for its fetch to start", () => {
  it("polls no sent log in any test", () => {
    expect(sentLogPolls(testFiles())).toEqual([])
  })

  it("names the file that polls the old line-47 shape of deck-star.test.ts", () => {
    const old = 'await expect.poll(() => sent).toEqual([{ deck: "deck-one", starred: true }])'
    expect(sentLogPolls({ "packages/live/src/deck-star.test.ts": old })).toEqual([
      "packages/live/src/deck-star.test.ts: wait with answeringServer().drained(queue) from packages/live/src/testing/answering-server.ts",
    ])
    expect(sentLogPolls({ "a.test.ts": "await expect.poll(() => server.sent).toHaveLength(1)" })).toHaveLength(1)
    expect(sentLogPolls({ "a.test.ts": "await expect.poll(() => stars(['deck-one'])).toEqual([])" })).toEqual([])
  })
})
