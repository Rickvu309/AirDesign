import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { authored, grownFiles, sizeFault, specifierBytes, tokenLimit, tokensOf } from "./file-size.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

same("the limit is five thousand tokens", tokenLimit, 5000)
same("four bytes make one token", [tokensOf(0), tokensOf(4), tokensOf(5), tokensOf(20000)], [0, 1, 2, 5000])

for (const file of [
  "apps/web/src/thin-deck.tsx",
  "scripts/check.mjs",
  "tests/browser/thin-deck.spec.ts",
  "AGENTS.md",
  "CHECKS.md",
  "specs/edit/Edit.tla",
]) {
  same(`${file} is written by agents`, authored(file), true)
}
for (const file of [
  "pnpm-lock.yaml",
  "metrics.json",
  "scripts/pptx-fixtures/clean.pptx",
  "apps/site/src/landing/product-demo/editor-demo-art.html",
  "apps/web/src/editor/revenue-slide-art.ts",
  "apps/site/public/mark.svg",
]) {
  same(`${file} is not written by agents`, authored(file), false)
}

const over = tokenLimit * 4 + 4
same("a file at the limit passes", sizeFault({ file: "a.ts", before: 0, after: tokenLimit * 4 }), undefined)
same("a small file that grows passes", sizeFault({ file: "a.ts", before: 10, after: 4000 }), undefined)
same(
  "a file over the limit that shrinks passes",
  sizeFault({ file: "a.ts", before: over + 400, after: over }),
  undefined,
)
same(
  "a file over the limit that stays the same size passes",
  sizeFault({ file: "a.ts", before: over, after: over }),
  undefined,
)
same(
  "a file that is not written by agents passes",
  sizeFault({ file: "pnpm-lock.yaml", before: 0, after: over }),
  undefined,
)
same(
  "a source file over the limit that grows is told how to split",
  sizeFault({ file: "apps/api/src/server.ts", before: over, after: over + 400 }),
  "apps/api/src/server.ts is 5101 tokens, over the limit of 5000, and this change adds 100. Move one idea out of it into a new file beside it, named after what the new file holds, and import it from there. Leave the rest where it is.",
)
same(
  "a test file over the limit that grows is told where the new test goes",
  sizeFault({ file: "apps/api/src/mcp/mcp.test.ts", before: over, after: over + 4 }),
  "apps/api/src/mcp/mcp.test.ts is 5002 tokens, over the limit of 5000, and this change adds 1. Put the new test in a new test file beside the code it tests, named after that code. Do not add to this file.",
)
same(
  "a new file over the limit is told the same",
  sizeFault({ file: "packages/live/src/new.ts", before: 0, after: over })?.startsWith(
    "packages/live/src/new.ts is 5001 tokens, over the limit of 5000, and this change adds 5001.",
  ),
  true,
)

same(
  "a longer import path is not growth, since a moved module adds no idea to the file",
  sizeFault({ file: "a.test.ts", before: over, after: over + 8, paths: { before: 20, after: 28 } }),
  undefined,
)
same(
  "growth beside a longer import path still counts",
  sizeFault({ file: "a.ts", before: over, after: over + 12, paths: { before: 20, after: 28 } })?.startsWith(
    "a.ts is 5004 tokens, over the limit of 5000, and this change adds 3.",
  ),
  true,
)
same(
  "only the text inside import and export specifiers is a path",
  specifierBytes(
    'import { a } from "./x.js"\nexport { b } from "../y/z.js"\nconst c = await import("./w.js")\nimport "./side.css"\nconst d = "from here"\n',
  ),
  "./x.js../y/z.js./w.js./side.css".length,
)

const repo = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-file-size-"))
process.on("exit", () => fs.rmSync(repo, { recursive: true, force: true }))
const git = (...args) =>
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
const write = (file, bytes) => {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
  fs.writeFileSync(path.join(repo, file), "x".repeat(bytes))
}
git("init", "--quiet")
git("config", "user.email", "a@b.c")
git("config", "user.name", "a")
write("src/big.ts", over)
write("src/small.ts", 40)
write("pnpm-lock.yaml", over)
git("add", "-A")
git("commit", "--quiet", "-m", "base")
git("update-ref", "refs/remotes/origin/main", "HEAD")
same("an untouched branch has nothing grown", grownFiles(repo), [])
write("src/big.ts", over + 40)
write("src/small.ts", 80)
write("pnpm-lock.yaml", over + 4000)
write("src/fresh.test.ts", over)
same(
  "the working tree is read against where the branch left main",
  grownFiles(repo).map(({ file, before, after }) => [file, before, after]),
  [
    ["pnpm-lock.yaml", over, over + 4000],
    ["src/big.ts", over, over + 40],
    ["src/fresh.test.ts", 0, over],
    ["src/small.ts", 40, 80],
  ],
)
const run = () => {
  try {
    return {
      status: 0,
      output: execFileSync(process.execPath, ["scripts/file-size.mjs", repo], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    }
  } catch (error) {
    return { status: error.status, output: `${error.stdout}${error.stderr}` }
  }
}
const failed = run()
same("the step fails when a file over the limit grew", failed.status, 1)
same(
  "the step names each file once",
  failed.output
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => line.split(" ")[0]),
  ["src/big.ts", "src/fresh.test.ts"],
)
write("src/big.ts", over)
fs.rmSync(path.join(repo, "src/fresh.test.ts"))
same("the step passes when nothing over the limit grew", run(), { status: 0, output: "" })
git("update-ref", "-d", "refs/remotes/origin/main")
same("a clone with no origin/main passes", run().status, 0)

console.log("file-size tests passed")
