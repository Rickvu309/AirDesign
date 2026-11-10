import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  changedFiles,
  changedProofs,
  checkChanges,
  checkFile,
  firstFailure,
  layIn,
  missingNeeds,
  proofEnv,
  proofFiles,
  proofRunner,
  proofState,
  proofSupport,
  readLosses,
  runProof,
  sandboxed,
  unprovedLines,
  verdict,
} from "./old-proofs.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const refusal = (run) => {
  try {
    run()
  } catch (error) {
    return error.message
  }
  return ""
}

const baseFiles = [
  "packages/document/src/order.test.ts",
  "scripts/sticks.mjs",
  "scripts/sticks.test.mjs",
  "scripts/pptx-judge/judge.test.mjs",
  "scripts/typed.test.ts",
  "tests/browser/every-screen.spec.ts",
  "tests/theme-tokens.test.ts",
  "tooling/oxlint-plugin-airdesign/harness.js",
  "tooling/oxlint-plugin-airdesign/rules/no-raw.js",
  "tooling/oxlint-plugin-airdesign/rules/no-raw.test.js",
  "tooling/oxlint-plugin-airdesign/scan-names.test.js",
]

same("a proof is a check test on the base", proofFiles(baseFiles), [
  "scripts/pptx-judge/judge.test.mjs",
  "scripts/sticks.test.mjs",
  "scripts/typed.test.ts",
  "tests/theme-tokens.test.ts",
  "tooling/oxlint-plugin-airdesign/rules/no-raw.test.js",
  "tooling/oxlint-plugin-airdesign/scan-names.test.js",
])
same("a tooling proof runs on plain Node", proofRunner("tooling/a/b/c.test.js"), "node")
same("a root test runs on Vitest", proofRunner("tests/new-package.test.ts"), "vitest")
same("a typed check test runs on Vitest", proofRunner("scripts/typed.test.ts"), "vitest")
same("the check code is not a proof", proofRunner("scripts/sticks.mjs"), undefined)
same("a product test is not a proof", proofRunner("packages/document/src/order.test.ts"), undefined)

same("the harness is proof support", proofSupport("tooling/oxlint-plugin-airdesign/harness.js"), true)
same("the test runner is proof support", proofSupport("tooling/oxlint-plugin-airdesign/run-tests.js"), true)
same("the proof run is proof support", proofSupport("scripts/old-proofs-run.mjs"), true)
same("a harness outside the check folders is product code", proofSupport("packages/pptx/src/harness.js"), false)

same("a rule is a check file", checkFile("tooling/oxlint-plugin-airdesign/rules/no-raw.js"), true)
same("a check script is a check file", checkFile("scripts/sticks.mjs"), true)
same(
  "nothing else is a check file",
  [
    "scripts/sticks.test.mjs",
    "scripts/typed.test.ts",
    "tooling/oxlint-plugin-airdesign/rules/no-raw.test.js",
    "tooling/oxlint-plugin-airdesign/harness.js",
    "tooling/oxlint-plugin-airdesign/run-tests.js",
    "scripts/old-proofs-run.mjs",
    "package.json",
    "pnpm-lock.yaml",
    "vitest.config.mts",
    ".oxlintrc.json",
    "tsconfig.json",
    "tests/theme-tokens.test.ts",
    "apps/web/src/main.tsx",
    "scripts/.npmrc",
    "tooling/.hidden/rule.js",
    "scripts/node_modules/vitest/index.js",
    "scripts/../package.json",
    "scripts//sticks.mjs",
  ].filter(checkFile),
  [],
)

const mergeTree = new Map([
  ["apps/web/src/main.tsx", "100644 a"],
  ["package.json", "100644 p"],
  ["scripts/sticks.mjs", "100644 b"],
  ["scripts/sticks.test.mjs", "100644 c"],
  ["scripts/gone.mjs", "100644 d"],
  ["tests/theme-tokens.test.ts", "100644 e"],
  ["vitest.config.mts", "100644 f"],
])
const headWith = (change) => new Map([...new Map([...mergeTree, ...change])].filter(([, entry]) => entry !== undefined))
const changesBy = (change) => checkChanges(mergeTree, headWith(change))

same(
  "an edit, a new file and a deleted file all count as changed",
  changedFiles(
    mergeTree,
    headWith([
      ["apps/web/src/main.tsx", "100644 z"],
      ["apps/web/src/new.tsx", "100644 n"],
      ["scripts/sticks.mjs", undefined],
    ]),
  ),
  ["apps/web/src/main.tsx", "apps/web/src/new.tsx", "scripts/sticks.mjs"],
)
same("product code alone changes no check", changesBy([["apps/web/src/main.tsx", "100644 z"]]), [])
same("nothing changed changes no check", changesBy([]), [])
same("an edited check script is laid in", changesBy([["scripts/sticks.mjs", "100644 z"]]), [
  { file: "scripts/sticks.mjs", entry: "100644 z" },
])
same("a new rule is laid in", changesBy([["tooling/rules/new.js", "100755 n"]]), [
  { file: "tooling/rules/new.js", entry: "100755 n" },
])
same("a deleted check file is taken out", changesBy([["scripts/gone.mjs", undefined]]), [
  { file: "scripts/gone.mjs", entry: undefined },
])
same(
  "a renamed check file is taken out and laid in",
  changesBy([
    ["scripts/gone.mjs", undefined],
    ["scripts/renamed.mjs", "100644 d"],
  ]),
  [
    { file: "scripts/gone.mjs", entry: undefined },
    { file: "scripts/renamed.mjs", entry: "100644 d" },
  ],
)
same(
  "the head's proofs, package file, lockfile and configs are never laid in",
  changesBy([
    ["scripts/sticks.test.mjs", "100644 soft"],
    ["scripts/added.test.mjs", "100644 new"],
    ["tests/theme-tokens.test.ts", undefined],
    ["tooling/oxlint-plugin-airdesign/harness.js", "100644 soft"],
    ["scripts/old-proofs-run.mjs", "100644 soft"],
    ["package.json", "100644 soft"],
    ["pnpm-lock.yaml", "100644 soft"],
    ["vitest.config.mts", "100644 soft"],
    [".oxlintrc.json", "100644 soft"],
    ["tsconfig.json", "100644 soft"],
    ["scripts/.npmrc", "100644 soft"],
    ["scripts/node_modules/vitest/index.js", "100644 soft"],
  ]),
  [],
)

same(
  "a config, a package file and the lockfile are named as having no proof",
  unprovedLines(
    mergeTree,
    headWith([
      ["vitest.config.mts", "100644 soft"],
      ["package.json", "100644 soft"],
      ["pnpm-lock.yaml", "100644 soft"],
      ["apps/web/src/main.tsx", "100644 z"],
      ["scripts/sticks.mjs", "100644 z"],
    ]),
  ),
  [
    "package.json changes how checks run and has no proof.",
    "pnpm-lock.yaml changes how checks run and has no proof.",
    "vitest.config.mts changes how checks run and has no proof. It is listed for the owner.",
  ],
)

same("a pull request behind main changed no check that main added later", changesBy([]), [])

same("a pull request behind main did not lose the proof main added later", changedProofs(mergeTree, headWith([])), [])
same(
  "a new proof and a changed check are not a changed proof",
  changedProofs(
    mergeTree,
    headWith([
      ["scripts/new.test.mjs", "100644 n"],
      ["scripts/sticks.mjs", "100644 x"],
    ]),
  ),
  [],
)
same(
  "a deleted proof and a changed proof are changed proofs",
  changedProofs(
    mergeTree,
    headWith([
      ["scripts/sticks.test.mjs", undefined],
      ["tests/theme-tokens.test.ts", "100644 x"],
    ]),
  ),
  ["scripts/sticks.test.mjs", "tests/theme-tokens.test.ts"],
)

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-old-proofs-"))
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }))
const base = path.join(root, "base")
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), text)
}
const baseText = (file) => fs.readFileSync(path.join(base, file), "utf8")
const inBase = (file) => fs.lstatSync(path.join(base, file), { throwIfNoEntry: false }) !== undefined
const headContent = (file, print) => Buffer.from(`head ${print}`)

const lossRepo = path.join(root, "losses")
const lossGit = (...args) =>
  execFileSync("git", ["-C", lossRepo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
const lossFile = (file, text) => write(path.join("losses", file), text)
const cases = "case one\ncase two\ncase three\n"
const lost = (lines) =>
  `lost ${lines} ${lines === 1 ? "line" : "lines"} it had on main. A proof may gain cases. It may not lose them.`
fs.mkdirSync(lossRepo)
lossGit("init", "--quiet")
for (const file of [
  "scripts/deleted.test.mjs",
  "scripts/renamed.test.mjs",
  "scripts/removed-line.test.mjs",
  "scripts/changed-line.test.mjs",
  "scripts/added-lines.test.mjs",
  "tests/typed.test.ts",
  "tooling/rules/harness.js",
  "scripts/sticks.mjs",
  "apps/web/src/main.test.ts",
]) {
  lossFile(file, cases)
}
lossGit("add", "--all")
const lossMerge = lossGit("write-tree")
same("an untouched proof lost nothing", readLosses(lossRepo, lossMerge, lossMerge), [])
fs.rmSync(path.join(lossRepo, "scripts/deleted.test.mjs"))
fs.renameSync(path.join(lossRepo, "scripts/renamed.test.mjs"), path.join(lossRepo, "scripts/moved.test.mjs"))
lossFile("scripts/removed-line.test.mjs", "case one\ncase three\n")
lossFile("scripts/changed-line.test.mjs", "case one\ncase 2\ncase three\n")
lossFile("scripts/added-lines.test.mjs", `case zero\n${cases}case four\n`)
lossFile("scripts/new.test.mjs", cases)
lossFile("tests/typed.test.ts", "")
lossFile("tooling/rules/harness.js", "case one\ncase two\n")
lossFile("scripts/sticks.mjs", "")
lossFile("apps/web/src/main.test.ts", "")
lossGit("add", "--all")
const lossHead = lossGit("write-tree")
const losses = readLosses(lossRepo, lossMerge, lossHead)
same(
  "a proof that was deleted, renamed, or lost or changed a line is broken, and one that only gained is free",
  losses,
  [
    { file: "scripts/changed-line.test.mjs", state: "broken", said: lost(1) },
    { file: "scripts/deleted.test.mjs", state: "broken", said: lost(3) },
    { file: "scripts/removed-line.test.mjs", state: "broken", said: lost(1) },
    { file: "scripts/renamed.test.mjs", state: "broken", said: lost(3) },
    { file: "tests/typed.test.ts", state: "broken", said: lost(3) },
    { file: "tooling/rules/harness.js", state: "broken", said: lost(1) },
  ],
)
same("a proof that lost a line fails with no check changed", verdict({ results: losses, approved: false }).pass, false)
same("the owner's approval lets a lost line through", verdict({ results: losses, approved: true }).pass, true)

write("base/package.json", "main package")
write("base/vitest.config.mts", "main config")
write("base/scripts/sticks.mjs", "main check")
write("base/scripts/sticks.test.mjs", "old cases")
write("base/scripts/gone.mjs", "main check")
write("base/tooling/rules/gone/deep.js", "main check")

layIn(
  base,
  [
    { file: "scripts/sticks.mjs", entry: "100644 softer" },
    { file: "scripts/gone.mjs", entry: undefined },
    { file: "scripts/never-there.mjs", entry: undefined },
    { file: "tooling/rules/gone/deep.js", entry: undefined },
    { file: "tooling/rules/new/rule.js", entry: "100755 added" },
  ],
  headContent,
)
same("a changed check file has the head's content", baseText("scripts/sticks.mjs"), "head softer")
same("a new check file is laid in under a new folder", baseText("tooling/rules/new/rule.js"), "head added")
same(
  "a check file keeps its executable bit",
  (fs.statSync(path.join(base, "tooling/rules/new/rule.js")).mode & 0o111) !== 0,
  true,
)
same("a deleted check file is removed from the base", inBase("scripts/gone.mjs"), false)
same("a deleted check file in a folder is removed from the base", inBase("tooling/rules/gone/deep.js"), false)
same("the base proof keeps its old cases", baseText("scripts/sticks.test.mjs"), "old cases")

for (const file of [
  "scripts/sticks.test.mjs",
  "package.json",
  "vitest.config.mts",
  "tooling/harness.js",
  "scripts/../package.json",
]) {
  same(
    `${file} from the head is refused`,
    refusal(() => layIn(base, [{ file, entry: "100644 softer" }], headContent)),
    `${file} is not a check file, so it is not taken from the pull request.`,
  )
}
same("the base proof still has its old cases", baseText("scripts/sticks.test.mjs"), "old cases")
same("the base package file is main's", baseText("package.json"), "main package")
same("the base config is main's", baseText("vitest.config.mts"), "main config")

same(
  "a link in the pull request is refused",
  refusal(() => layIn(base, [{ file: "scripts/linked.mjs", entry: "120000 link" }], headContent)),
  "scripts/linked.mjs is a link in the pull request. A check file must be a plain file.",
)
same("the refused link wrote nothing", inBase("scripts/linked.mjs"), false)
same(
  "a nested repository in the pull request is refused",
  refusal(() => layIn(base, [{ file: "scripts/nested", entry: "160000 commit" }], headContent)),
  "scripts/nested is a link in the pull request. A check file must be a plain file.",
)

write("outside/kept.mjs", "outside")
fs.symlinkSync(path.join(root, "outside"), path.join(base, "tooling/linked-folder"))
same(
  "a check file under a linked folder is refused",
  refusal(() => layIn(base, [{ file: "tooling/linked-folder/kept.mjs", entry: "100644 softer" }], headContent)),
  "tooling/linked-folder is a link on main, so tooling/linked-folder/kept.mjs cannot be laid in.",
)
same(
  "a delete under a linked folder is refused",
  refusal(() => layIn(base, [{ file: "tooling/linked-folder/kept.mjs", entry: undefined }], headContent)),
  "tooling/linked-folder is a link on main, so tooling/linked-folder/kept.mjs cannot be laid in.",
)
same("the link's target is not written", fs.readFileSync(path.join(root, "outside/kept.mjs"), "utf8"), "outside")

fs.symlinkSync(path.join(root, "outside/kept.mjs"), path.join(base, "scripts/linked-file.mjs"))
layIn(base, [{ file: "scripts/linked-file.mjs", entry: "100644 plain" }], headContent)
same("a link on main becomes a plain file", fs.lstatSync(path.join(base, "scripts/linked-file.mjs")).isFile(), true)
same("the file link's target is not written", fs.readFileSync(path.join(root, "outside/kept.mjs"), "utf8"), "outside")

const token = "f".repeat(48)
same(
  "a proof that exits 0 and prints the token is kept",
  proofState({ runner: "node", status: 0, stdout: `case one\n${token}\n`, token }),
  { state: "kept" },
)
same(
  "a proof that exits 0 without the token is broken",
  proofState({ runner: "node", status: 0, stdout: "case one\n", token }),
  { state: "broken", message: "stopped before it finished" },
)
same("a silent exit 0 is broken", proofState({ runner: "node", status: 0, stdout: "", token: "" }), {
  state: "broken",
  message: "stopped before it finished",
})
same(
  "a proof that prints the token and fails is broken",
  proofState({ runner: "node", status: 1, stdout: `${token}\n`, stderr: "Error: no-raw rejects a hex color", token }),
  { state: "broken", message: "no-raw rejects a hex color" },
)

const passedReport = { success: true, numTotalTests: 2, numPassedTests: 2, numFailedTests: 0, testResults: [] }
same("a Vitest proof with a passed test is kept", proofState({ runner: "vitest", status: 0, report: passedReport }), {
  state: "kept",
})
same(
  "a Vitest proof that ran no test is broken",
  proofState({
    runner: "vitest",
    status: 0,
    report: { success: true, numTotalTests: 0, numPassedTests: 0, numFailedTests: 0, testResults: [] },
  }),
  { state: "broken", message: "ran no test" },
)
same("a Vitest proof with no report is broken", proofState({ runner: "vitest", status: 0 }), {
  state: "broken",
  message: "ran no test",
})
same(
  "a failed Vitest case is named with its error",
  proofState({
    runner: "vitest",
    status: 1,
    report: {
      success: false,
      numTotalTests: 1,
      numPassedTests: 0,
      numFailedTests: 1,
      testResults: [
        {
          assertionResults: [
            {
              status: "failed",
              fullName: "theme tokens shares one file",
              failureMessages: ["AssertionError: expected 'a' to contain 'b'\n    at file.ts:1:1"],
            },
          ],
        },
      ],
    },
  }),
  { state: "broken", message: "theme tokens shares one file: AssertionError: expected 'a' to contain 'b'" },
)

fs.mkdirSync(path.join(base, "scripts"), { recursive: true })
fs.copyFileSync(path.join(import.meta.dirname, "old-proofs-run.mjs"), path.join(base, "scripts/old-proofs-run.mjs"))
write("base/scripts/exits.mjs", 'if (process.argv[1].endsWith("old-proofs-run.mjs")) process.exit(0)\n')
write("base/scripts/exits.test.mjs", 'import "./exits.mjs"\nthrow new Error("the softened check was caught")\n')
write("base/scripts/exits-later.test.mjs", "setTimeout(() => process.exit(0), 10)\n")
write("base/scripts/echo.test.mjs", "console.log(process.argv.join(), JSON.stringify(process.env))\nprocess.exit(0)\n")
write("base/scripts/holds.test.mjs", 'console.log("case one")\n')
write("base/scripts/throws.test.mjs", 'throw new Error("sticks rejects a raised limit")\n')
write("base/scripts/swallows.test.mjs", 'process.on("uncaughtException", () => {})\nthrow new Error("swallowed")\n')
write(
  "base/scripts/hangs.test.mjs",
  [
    'import { spawn } from "node:child_process"',
    'import fs from "node:fs"',
    'import path from "node:path"',
    'const child = spawn("sleep", ["600"], { stdio: "inherit" })',
    'fs.writeFileSync(path.join(process.env.TMPDIR, "..", "hangs-child"), String(child.pid))',
    "setInterval(() => {}, 1000)",
    "",
  ].join("\n"),
)
const ran = (file) => runProof(base, file, { has: () => true })
const hangsChild = path.join(os.tmpdir(), "hangs-child")
same("a proof that hangs is broken", runProof(base, "scripts/hangs.test.mjs", { has: () => true, seconds: 1 }), {
  file: "scripts/hangs.test.mjs",
  state: "broken",
  said: "did not finish in 1 s",
})
const leftRunning = (pid) => {
  try {
    return fs.readFileSync(`/proc/${pid}/stat`, "utf8").split(") ").at(-1)[0] !== "Z"
  } catch {
    return false
  }
}
same("a proof that hangs leaves no child running", leftRunning(fs.readFileSync(hangsChild, "utf8")), false)
fs.rmSync(hangsChild)
same("a proof that finishes is kept", ran("scripts/holds.test.mjs"), {
  file: "scripts/holds.test.mjs",
  state: "kept",
})
same("a check that exits 0 under a proof is broken", ran("scripts/exits.test.mjs"), {
  file: "scripts/exits.test.mjs",
  state: "broken",
  message: "stopped before it finished",
})
same("an exit 0 after the import settled is broken", ran("scripts/exits-later.test.mjs"), {
  file: "scripts/exits-later.test.mjs",
  state: "broken",
  message: "stopped before it finished",
})
same("the token is not in the arguments or the environment", ran("scripts/echo.test.mjs"), {
  file: "scripts/echo.test.mjs",
  state: "broken",
  message: "stopped before it finished",
})
same("a thrown case is broken and named", ran("scripts/throws.test.mjs"), {
  file: "scripts/throws.test.mjs",
  state: "broken",
  message: "sticks rejects a raised limit",
})
same("a swallowed failure is broken", ran("scripts/swallows.test.mjs").state, "broken")

const thrownByNode = [
  "file:///work/base/tooling/oxlint-plugin-airdesign/harness.js:53",
  "    throw new Error(`${name}`)",
  "          ^",
  "",
  "Error: no-comments rejects a block comment",
  'expected a failure containing "Remove this comment."',
  "    at expectRejects (file:///work/base/tooling/oxlint-plugin-airdesign/harness.js:53:11)",
].join("\n")
same(
  "the thrown case names the failure",
  firstFailure({ status: 1, output: thrownByNode }),
  "no-comments rejects a block comment",
)
same(
  "a missing check names the failure",
  firstFailure({
    status: 1,
    output: "node:internal\n\nError [ERR_MODULE_NOT_FOUND]: Cannot find module '/work/base/scripts/sticks.mjs'",
  }),
  "Cannot find module '/work/base/scripts/sticks.mjs'",
)
same("a silent failure names its exit", firstFailure({ status: 3, output: "\n" }), "exit 3")
same("a proof that ran out of time is broken", proofState({ runner: "node", status: 124, stdout: "", token: "t" }), {
  state: "broken",
  said: "did not finish in 300 s",
})

const advice =
  "Restore the behaviour each broken case expects and the lines each proof lost. If the check is meant to change, ask the repo owner to approve the pull request, then run this check again."
const results = [
  { file: "scripts/sticks.test.mjs", state: "kept" },
  { file: "tooling/rules/no-raw.test.js", state: "broken", message: "no-raw rejects a hex color" },
  { file: "scripts/check-specs.test.mjs", state: "not proved", message: "this machine has no Java 21" },
]
same(
  "a broken proof with its own sentence is printed as that sentence",
  verdict({
    results: [{ file: "scripts/sticks.test.mjs", state: "broken", said: "did not finish in 300 s" }],
    approved: true,
  }).lines[0],
  "broken: scripts/sticks.test.mjs did not finish in 300 s",
)
const brokenLines = [
  "kept scripts/sticks.test.mjs",
  "broken tooling/rules/no-raw.test.js: no-raw rejects a hex color",
  "not proved here scripts/check-specs.test.mjs: this machine has no Java 21",
]
same("one broken proof fails and says what to do", verdict({ results, approved: false }), {
  pass: false,
  lines: [...brokenLines, advice],
})
same("a broken proof behind main says to update", verdict({ results, approved: false, behind: true }), {
  pass: false,
  lines: [...brokenLines, "This pull request is behind main. Update it and run again."],
})
same("the owner's approval lets a broken proof through", verdict({ results, approved: true }), {
  pass: true,
  lines: [...brokenLines, "The repo owner approved this commit, so it passes as it is."],
})
same(
  "kept proofs pass, also behind main",
  verdict({ results: [results[0], results[2]], approved: false, behind: true }),
  {
    pass: true,
    lines: [brokenLines[0], brokenLines[2]],
  },
)

same(
  "a proof with every need runs",
  missingNeeds("scripts/check-specs.test.mjs", () => true),
  [],
)
same(
  "a proof without Java is not proved here",
  missingNeeds("scripts/check-specs.test.mjs", (need) => need !== "Java 21"),
  ["Java 21"],
)
same("a proof without git is not proved here", runProof(base, "scripts/sticks.test.mjs", { has: () => false }), {
  file: "scripts/sticks.test.mjs",
  state: "not proved",
  message: "this machine has no git",
})
const unprovedInCi = runProof(base, "scripts/sticks.test.mjs", { has: () => false, runsInCi: true })
same("a proof without git is broken in CI", unprovedInCi, {
  file: "scripts/sticks.test.mjs",
  state: "broken",
  said: "could not be proved here: this machine has no git",
})
same("a proof that could not be proved fails in CI", verdict({ results: [unprovedInCi], approved: false }), {
  pass: false,
  lines: ["broken: scripts/sticks.test.mjs could not be proved here: this machine has no git", advice],
})
same(
  "a plain proof needs nothing",
  missingNeeds("scripts/failure-audit.test.mjs", () => false),
  [],
)

const env = proofEnv({ home: "/scratch", nodeFolder: "/node/bin", tools: { JAVA: "/jdk/bin/java" } })
same("a proof sees only a path, a scratch home and its tools", env, {
  PATH: "/node/bin:/usr/local/bin:/usr/bin:/bin",
  HOME: "/scratch",
  TMPDIR: "/scratch",
  NO_COLOR: "1",
  CI: "true",
  GITHUB_ACTIONS: "true",
  JAVA: "/jdk/bin/java",
})
same(
  "a proof sees the gate's environment, in CI and locally",
  [
    proofEnv({ home: "/scratch", nodeFolder: "/node/bin" }).CI,
    proofEnv({ home: "/s", nodeFolder: "/n" }).GITHUB_ACTIONS,
  ],
  ["true", "true"],
)
const command = ["/node/bin/node", "scripts/old-proofs-run.mjs", "scripts/sticks.test.mjs"]
const cleared = [
  "env",
  "-i",
  "PATH=/node/bin:/usr/local/bin:/usr/bin:/bin",
  "HOME=/scratch",
  "TMPDIR=/scratch",
  "NO_COLOR=1",
  "CI=true",
  "GITHUB_ACTIONS=true",
  "JAVA=/jdk/bin/java",
  "timeout",
  "--kill-after=10",
  "300",
  ...command,
]
same("a local proof runs with a cleared environment", sandboxed({ env, command, runsInCi: false }), cleared)
same(
  "a proof in CI runs with no network, as nobody, with no way back up",
  sandboxed({ env, command, runsInCi: true }),
  [
    "sudo",
    "-n",
    "unshare",
    "--net",
    "--",
    "setpriv",
    "--reuid=65534",
    "--regid=65534",
    "--clear-groups",
    "--no-new-privs",
    "--",
    ...cleared,
  ],
)
