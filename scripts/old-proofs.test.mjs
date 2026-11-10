import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  changedFiles,
  checkChanged,
  firstFailure,
  headEnv,
  missingNeeds,
  proofFiles,
  proofRunner,
  proofSupport,
  restoreProofs,
  verdict,
} from "./old-proofs.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const baseFiles = [
  "packages/document/src/order.test.ts",
  "scripts/sticks.mjs",
  "scripts/sticks.test.mjs",
  "scripts/pptx-judge/judge.test.mjs",
  "tests/browser/every-screen.spec.ts",
  "tests/theme-tokens.test.ts",
  "tooling/oxlint-plugin-airdesign/harness.js",
  "tooling/oxlint-plugin-airdesign/rules/no-raw.js",
  "tooling/oxlint-plugin-airdesign/rules/no-raw.test.js",
  "tooling/oxlint-plugin-airdesign/scan-names.test.js",
]

same("a proof is a check test on the base", proofFiles(baseFiles), [
  "scripts/sticks.test.mjs",
  "tests/theme-tokens.test.ts",
  "tooling/oxlint-plugin-airdesign/rules/no-raw.test.js",
  "tooling/oxlint-plugin-airdesign/scan-names.test.js",
])
same("the harness a proof leans on is put back too", proofSupport(baseFiles), [
  "tooling/oxlint-plugin-airdesign/harness.js",
])
same("a harness outside the check folders is product code", proofSupport(["packages/pptx/src/harness.js"]), [])
same("a tooling proof runs on plain Node", proofRunner("tooling/a/b/c.test.js"), "node")
same("a root test runs on Vitest", proofRunner("tests/new-package.test.ts"), "vitest")
same("the check code is not a proof", proofRunner("scripts/sticks.mjs"), undefined)

const baseTree = new Map([
  ["apps/web/src/main.tsx", "100644 a 0"],
  ["scripts/sticks.mjs", "100644 b 0"],
  ["tests/theme-tokens.test.ts", "100644 c 0"],
])
const headWith = (change) => new Map([...new Map([...baseTree, ...change])].filter(([, print]) => print !== undefined))
const restorable = ["tests/theme-tokens.test.ts"]
const changedBy = (change) => changedFiles(baseTree, headWith(change))

same(
  "an edit, a new file and a deleted file all count as changed",
  changedBy([
    ["apps/web/src/main.tsx", "100644 z 0"],
    ["apps/web/src/new.tsx", "100644 n 0"],
    ["scripts/sticks.mjs", undefined],
  ]),
  ["apps/web/src/main.tsx", "apps/web/src/new.tsx", "scripts/sticks.mjs"],
)
same(
  "product code alone changes no check",
  checkChanged(changedBy([["apps/web/src/main.tsx", "100644 z 0"]]), restorable),
  false,
)
same("nothing changed changes no check", checkChanged(changedBy([]), restorable), false)
same(
  "an edited check script changes a check",
  checkChanged(changedBy([["scripts/sticks.mjs", "100644 z 0"]]), restorable),
  true,
)
same("a new rule changes a check", checkChanged(changedBy([["tooling/rules/new.js", "100644 n 0"]]), restorable), true)
same(
  "a deleted proof outside the check folders changes a check",
  checkChanged(changedBy([["tests/theme-tokens.test.ts", undefined]]), restorable),
  true,
)

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-old-proofs-"))
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }))
const write = (side, file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, side, file)), { recursive: true })
  fs.writeFileSync(path.join(root, side, file), text)
}
const headText = (file) => fs.readFileSync(path.join(root, "head", file), "utf8")
write("base", "scripts/edited.test.mjs", "old cases")
write("base", "scripts/deleted.test.mjs", "old cases")
write("base", "tooling/rules/gone/deep.test.js", "old cases")
write("head", "scripts/edited.test.mjs", "softer cases")
write("head", "scripts/added.test.mjs", "new cases")

same(
  "a deleted proof is put back and named",
  restoreProofs(path.join(root, "base"), path.join(root, "head"), [
    "scripts/deleted.test.mjs",
    "scripts/edited.test.mjs",
    "tooling/rules/gone/deep.test.js",
  ]),
  ["scripts/deleted.test.mjs", "tooling/rules/gone/deep.test.js"],
)
same("the deleted proof has its old cases", headText("scripts/deleted.test.mjs"), "old cases")
same("a proof in a deleted folder has its old cases", headText("tooling/rules/gone/deep.test.js"), "old cases")
same("the head's edit of a proof is ignored", headText("scripts/edited.test.mjs"), "old cases")
same("a proof only the head has is left alone", headText("scripts/added.test.mjs"), "new cases")

write("base", "scripts/linked.test.mjs", "old cases")
write("head", "elsewhere/linked.test.mjs", "softer cases")
fs.symlinkSync("../elsewhere/linked.test.mjs", path.join(root, "head/scripts/linked.test.mjs"))
restoreProofs(path.join(root, "base"), path.join(root, "head"), ["scripts/linked.test.mjs"])
same(
  "a proof the head made a link becomes a plain file",
  fs.lstatSync(path.join(root, "head/scripts/linked.test.mjs")).isFile(),
  true,
)
same("the link's target is not written", headText("elsewhere/linked.test.mjs"), "softer cases")

write("base", "linked-folder/held.test.mjs", "old cases")
fs.symlinkSync("elsewhere", path.join(root, "head/linked-folder"))
let refused = ""
try {
  restoreProofs(path.join(root, "base"), path.join(root, "head"), ["linked-folder/held.test.mjs"])
} catch (error) {
  refused = error.message
}
same(
  "a proof under a linked folder is refused",
  refused,
  "linked-folder is a link in the pull request, so linked-folder/held.test.mjs cannot be put back.",
)

const thrownByNode = [
  "file:///work/head/tooling/oxlint-plugin-airdesign/harness.js:53",
  "    throw new Error(`${name}`)",
  "          ^",
  "",
  "Error: no-comments rejects a block comment",
  'expected a failure containing "Remove this comment."',
  "    at expectRejects (file:///work/head/tooling/oxlint-plugin-airdesign/harness.js:53:11)",
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
    output: "node:internal\n\nError [ERR_MODULE_NOT_FOUND]: Cannot find module '/work/head/scripts/sticks.mjs'",
  }),
  "Cannot find module '/work/head/scripts/sticks.mjs'",
)
same(
  "a failed Vitest case is named with its error",
  firstFailure({
    status: 1,
    output:
      " FAIL  tests/theme-tokens.test.ts > theme tokens > shares one file\nAssertionError: expected 'a' to contain 'b'",
  }),
  "FAIL  tests/theme-tokens.test.ts > theme tokens > shares one file: expected 'a' to contain 'b'",
)
same("a silent failure names its exit", firstFailure({ status: 3, output: "\n" }), "exit 3")
same(
  "a proof that hangs is named",
  firstFailure({ status: null, output: "", timedOut: true }),
  "ran longer than 300 seconds",
)

const advice =
  "Restore the behaviour each broken case expects. If the check is meant to change, ask the repo owner to approve the pull request."
const results = [
  { file: "scripts/sticks.test.mjs", state: "kept" },
  { file: "tooling/rules/no-raw.test.js", state: "broken", message: "no-raw rejects a hex color" },
  { file: "scripts/check-specs.test.mjs", state: "not proved", message: "this machine has no Java 21" },
]
const brokenLines = [
  "kept scripts/sticks.test.mjs",
  "broken tooling/rules/no-raw.test.js: no-raw rejects a hex color",
  "not proved here scripts/check-specs.test.mjs: this machine has no Java 21",
]
same("one broken proof fails and says what to do", verdict({ results, approved: false }), {
  pass: false,
  lines: [...brokenLines, advice],
})
same("the owner's approval lets a broken proof through", verdict({ results, approved: true }), {
  pass: true,
  lines: [...brokenLines, "The repo owner approved this commit, so it passes as it is."],
})
same("kept proofs pass", verdict({ results: [results[0], results[2]], approved: false }), {
  pass: true,
  lines: [brokenLines[0], brokenLines[2]],
})

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
same(
  "a plain proof needs nothing",
  missingNeeds("scripts/sticks.test.mjs", () => false),
  [],
)

same(
  "head code sees no token and no runner file",
  headEnv({
    PATH: "/bin",
    GH_TOKEN: "t",
    GITHUB_OUTPUT: "/o",
    ACTIONS_RUNTIME_TOKEN: "t",
    NPM_SECRET: "s",
    JAVA_HOME_21_X64: "/j",
  }),
  { PATH: "/bin", JAVA_HOME_21_X64: "/j", NO_COLOR: "1" },
)
