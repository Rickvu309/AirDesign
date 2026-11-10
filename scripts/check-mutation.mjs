import { readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Stryker } from "@stryker-mutator/core"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const mutatedPackages = ["packages/document/src", "packages/pptx/src"]
const workers = 4
const listedSurvivors = 50
const tsconfigStrykerCannotParseWithTypescript7 = "no-tsconfig-to-rewrite.json"
const stickName = "guards a test would miss"

const sourcePattern = (target) => {
  const relative = path.relative(root, path.resolve(root, target)).split(path.sep).join("/")
  return statSync(path.join(root, relative)).isDirectory() ? `${relative}/**/*.ts` : relative
}

const targets = process.argv.slice(2)
const mutate = [...(targets.length > 0 ? targets : mutatedPackages).map(sourcePattern), "!**/*.test.ts"]

process.chdir(root)
const mutants = await new Stryker({
  mutate,
  plugins: ["@stryker-mutator/vitest-runner"],
  testRunner: "vitest",
  vitest: { configFile: "scripts/mutation.vitest.config.mts", related: true },
  coverageAnalysis: "perTest",
  concurrency: workers,
  reporters: [],
  logLevel: "error",
  tsconfigFile: tsconfigStrykerCannotParseWithTypescript7,
  tempDirName: ".stryker-tmp",
  cleanTempDir: "always",
  incremental: false,
  allowEmpty: true,
}).runMutationTest()

if (mutants.length === 0) {
  console.error("Nothing to mutate there. Name a source file or a package folder, not a test.")
  process.exit(1)
}

const withStatus = (status) => mutants.filter((mutant) => mutant.status === status)
const missed = [...withStatus("Survived"), ...withStatus("NoCoverage")]

const sourceLines = new Map()
const linesOf = (fileName) => {
  if (!sourceLines.has(fileName)) sourceLines.set(fileName, readFileSync(fileName, "utf8").split("\n"))
  return sourceLines.get(fileName)
}

const oneLine = (text) => text.replace(/\s+/g, " ").trim()

const original = ({ fileName, location: { start, end } }) => {
  const lines = linesOf(fileName).slice(start.line - 1, end.line)
  lines[lines.length - 1] = lines[lines.length - 1].slice(0, end.column - 1)
  lines[0] = lines[0].slice(start.column - 1)
  return oneLine(lines.join("\n"))
}

const position = (mutant) => `${path.relative(root, mutant.fileName)}:${mutant.location.start.line}`

const byPosition = (left, right) =>
  left.fileName.localeCompare(right.fileName) ||
  left.location.start.line - right.location.start.line ||
  left.location.start.column - right.location.start.column

console.log(`stick ${stickName}  now ${missed.length}  goal 0`)
for (const mutant of missed.toSorted(byPosition).slice(0, listedSurvivors))
  console.log(
    `${position(mutant)}  ${original(mutant)} -> ${oneLine(mutant.replacement ?? "")}${mutant.status === "NoCoverage" ? "  (no test runs this line)" : ""}`,
  )
if (missed.length > listedSurvivors) console.log(`and ${missed.length - listedSurvivors} more`)
console.log(
  `mutants ${mutants.length}  killed ${withStatus("Killed").length}  survived ${withStatus("Survived").length}  no-coverage ${withStatus("NoCoverage").length}  timeout ${withStatus("Timeout").length}  errors ${withStatus("CompileError").length + withStatus("RuntimeError").length}`,
)
