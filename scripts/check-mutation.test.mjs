import { execFileSync } from "node:child_process"
import { changedSources, holdsNoCode, linkedPaths, survivorLines, totalLine } from "./check-mutation.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

same("a changed package source is chosen", changedSources("M\tpackages/document/src/limits.ts\n"), [
  "packages/document/src/limits.ts",
])
same("an added tsx source is chosen", changedSources("A\tpackages/render/src/view.tsx\n"), [
  "packages/render/src/view.tsx",
])
same("a changed api source is chosen", changedSources("M\tapps/api/src/deck.ts\n"), ["apps/api/src/deck.ts"])
same("a nested source is chosen", changedSources("M\tpackages/mcp/src/tools/edit.ts\n"), [
  "packages/mcp/src/tools/edit.ts",
])
same(
  "every chosen source keeps the order git gave",
  changedSources("M\tapps/api/src/mcp/mcp.ts\nM\tpackages/mcp/src/run.ts\nA\tpackages/live/src/cache.ts\n"),
  ["apps/api/src/mcp/mcp.ts", "packages/mcp/src/run.ts", "packages/live/src/cache.ts"],
)
same("a deleted source is not chosen", changedSources("D\tpackages/document/src/limits.ts\n"), [])
same("a test is not chosen", changedSources("M\tpackages/document/src/limits.test.ts\n"), [])
same("a tsx test is not chosen", changedSources("M\tapps/api/src/view.test.tsx\n"), [])
same("a named test is not chosen", changedSources("M\tpackages/document/src/decide.property.test.ts\n"), [])
same("a spec is not chosen", changedSources("M\tpackages/document/src/decide.spec.ts\n"), [])
same("a declaration is not chosen", changedSources("M\tpackages/render/src/types.d.ts\n"), [])
same("the api test harness is not chosen", changedSources("M\tapps/api/src/testing/harness.ts\n"), [])
same("the api postgres setup is not chosen", changedSources("M\tapps/api/src/testing/postgres-setup.ts\n"), [])
same(
  "a package helper in src/testing is not chosen",
  changedSources("M\tpackages/doom/src/testing/doom-fixtures-art.ts\n"),
  [],
)
same("a web source is not chosen", changedSources("M\tapps/web/src/deck.ts\n"), [])
same("a site source is not chosen", changedSources("M\tapps/site/src/page.ts\n"), [])
same("a package file outside src is not chosen", changedSources("M\tpackages/pptx/markup-setup.ts\n"), [])
same("a script is not chosen", changedSources("M\tscripts/check.mjs\n"), [])
same("another extension is not chosen", changedSources("M\tpackages/theme/src/tokens.css\n"), [])
same("a module script in src is not chosen", changedSources("M\tpackages/document/src/run.mts\n"), [])
same("a folder that only starts like a root is not chosen", changedSources("M\tapps/api-old/src/deck.ts\n"), [])
same("no change chooses nothing", changedSources(""), [])

same("a file of re-exports holds no code", holdsNoCode('export * from "./a"\nexport type { B } from "./b"\n'), true)
same(
  "a re-export list over many lines holds no code",
  holdsNoCode('export {\n  elementId,\n  slideId,\n} from "./ids"\nexport type {\n  Slide,\n} from "./slide"\n'),
  true,
)
same("a function holds code", holdsNoCode('export const timeoutMs = 30000\nexport * from "./a"\n'), false)
same("an import with an export holds code", holdsNoCode('import { a } from "./a"\nexport { a }\n'), false)
same("an empty file holds no code", holdsNoCode(""), true)

const at = (fileName, line, status, mutatorName, column = 1) => ({
  fileName,
  status,
  mutatorName,
  location: { start: { line, column } },
})

same(
  "a survivor and an uncovered mutant are listed by file and line",
  survivorLines([
    at("packages/b.ts", 3, "Survived", "BooleanLiteral"),
    at("packages/a.ts", 9, "NoCoverage", "StringLiteral"),
    at("packages/a.ts", 2, "Survived", "ConditionalExpression"),
  ]),
  [
    "survived packages/a.ts:2 ConditionalExpression",
    "survived packages/a.ts:9 StringLiteral",
    "survived packages/b.ts:3 BooleanLiteral",
  ],
)
same(
  "a killed, timed out or broken mutant is not listed",
  survivorLines([
    at("a.ts", 1, "Killed", "BlockStatement"),
    at("a.ts", 2, "Timeout", "BlockStatement"),
    at("a.ts", 3, "CompileError", "BlockStatement"),
    at("a.ts", 4, "RuntimeError", "BlockStatement"),
  ]),
  [],
)
same(
  "the total counts each status",
  totalLine([
    at("a.ts", 1, "Killed", "m"),
    at("a.ts", 2, "Killed", "m"),
    at("a.ts", 3, "Survived", "m"),
    at("a.ts", 4, "NoCoverage", "m"),
    at("a.ts", 5, "Timeout", "m"),
    at("a.ts", 6, "CompileError", "m"),
    at("a.ts", 7, "RuntimeError", "m"),
  ]),
  "mutants 7  killed 2  survived 1  no-coverage 1  timeout 1  errors 2",
)
same("no mutants total zero", totalLine([]), "mutants 0  killed 0  survived 0  no-coverage 0  timeout 0  errors 0")

same(
  "every symlink git tracks is kept out of the sandbox Stryker copies, which cannot copy a linked folder",
  linkedPaths(
    "100644 1a2b 0\tAGENTS.md\n120000 3c4d 0\t.claude/skills/verify-airdesign\n160000 5e6f 0\tvendor/sub\n120000 7a8b 0\tdocs/link\n",
  ),
  ["/.claude/skills/verify-airdesign", "/docs/link"],
)
same(
  "the repo's linked skill folders are among them",
  linkedPaths(execFileSync("git", ["ls-files", "-s"], { encoding: "utf8" })).includes(
    "/.claude/skills/verify-airdesign",
  ),
  true,
)
