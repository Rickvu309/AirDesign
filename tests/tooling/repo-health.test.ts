import { execFileSync } from "node:child_process"
import { expect, it } from "vitest"

it("protects active, dirty, unmerged and borrowed worktrees and reports exact workflow conclusions", () => {
  const output = execFileSync("python3", ["-B", "-m", "unittest", "discover", "-s", "scripts/repo", "-p", "test_health.py", "-v"], { encoding: "utf8", timeout: 30_000, stdio: "pipe" })
  expect(output).toBe("")
}, 35_000)
