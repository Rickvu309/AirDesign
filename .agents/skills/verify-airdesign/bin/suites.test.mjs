import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { failedTests, pptxPaths, rerunCommand, suiteRules, suitesFor } from "./suites.mjs"

const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: path.dirname(fileURLToPath(import.meta.url)),
  encoding: "utf8",
}).trim()
const rules = suiteRules(repo)
const names = (changed) => suitesFor(changed, rules).map((suite) => suite.name)

describe("suitesFor", () => {
  it("runs the browser suite and the journeys for a change to a package the web app imports", () => {
    expect(names(["packages/render/src/slide-canvas.tsx"])).toEqual(["check", "browser", "journeys", "pptx"])
    expect(names(["packages/theme/tokens.css"])).toEqual(["check", "browser", "journeys"])
  })

  it("runs the journeys but not the browser suite for a server-only change", () => {
    expect(names(["apps/api/src/aira.ts"])).toEqual(["check", "journeys"])
    expect(names(["packages/mcp/src/call-tool.ts"])).toEqual(["check", "journeys"])
  })

  it("runs only the check for a change outside the apps", () => {
    expect(names(["scripts/metrics.mjs"])).toEqual(["check", "pptx"])
    expect(names(["GLOSSARY.md"])).toEqual(["check"])
  })

  it("does not treat a path that only starts like a folder as inside it", () => {
    expect(names(["apps/website/x.ts"])).toEqual(["check"])
  })

  it("names the first changed file that needs each suite", () => {
    expect(
      suitesFor(["GLOSSARY.md", "tests/browser/home.spec.ts"], rules).find((suite) => suite.name === "browser"),
    ).toMatchObject({
      because: "tests/browser/home.spec.ts",
    })
  })
})

describe("pptxPaths", () => {
  it("reads the paths the pptx job of ci watches", () => {
    const workflow =
      "        run: git diff --quiet $BASE HEAD -- packages/pptx scripts/pptx-check.mjs && echo changed=0"
    expect(pptxPaths(workflow)).toEqual(["packages/pptx", "scripts/pptx-check.mjs"])
  })
})

describe("failedTests and rerunCommand", () => {
  const report = {
    suites: [
      {
        specs: [],
        suites: [
          {
            specs: [
              { ok: true, file: "home.spec.ts", line: 4, title: "lists" },
              { ok: false, file: "home.spec.ts", line: 9, title: "trash" },
            ],
          },
        ],
      },
    ],
  }

  it("lists each failed test once with its file and line", () => {
    expect(failedTests(report)).toEqual([{ file: "home.spec.ts", line: 9, title: "trash" }])
  })

  it("gives one command that reruns only the failed browser tests", () => {
    expect(rerunCommand("browser", failedTests(report))).toBe(
      "node .agents/skills/verify-airdesign/bin/verify-airdesign.mjs suites --run browser -- tests/browser/home.spec.ts:9",
    )
  })

  it("reruns failed journeys by name", () => {
    expect(
      rerunCommand("journeys", [
        { file: "journeys.spec.ts", line: 5, title: "aira-panel" },
        { file: "journeys.spec.ts", line: 5, title: "move-resize" },
      ]),
    ).toBe(
      "node .agents/skills/verify-airdesign/bin/verify-airdesign.mjs suites --run journeys -- -g 'aira-panel|move-resize'",
    )
  })

  it("has nothing to rerun when nothing failed", () => {
    expect(rerunCommand("browser", [])).toBeUndefined()
  })
})
