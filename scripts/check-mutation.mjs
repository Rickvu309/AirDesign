import { execFileSync } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const self = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(self), "..")
const mutatedPackages = ["packages/document/src", "packages/pptx/src"]
const workers = 4
const listedSurvivors = 50
const tsconfigStrykerCannotParseWithTypescript7 = "no-tsconfig-to-rewrite.json"
const metricName = "guards a test would miss"
const changedFlag = "--changed-from"
const changedFolders = /^(?:packages\/[^/]+|apps\/api)\/src\/.+\.tsx?$/
const testNames = /\.(?:test|spec)\.tsx?$|\.d\.ts$/
const testSupport = new Set(["apps/api/src/harness.ts", "apps/api/src/postgres-setup.ts"])

export const changedSources = (nameStatus) =>
  nameStatus.split("\n").flatMap((row) => {
    const [status, file] = row.split("\t")
    const chosen = status !== "D" && changedFolders.test(file ?? "") && !testNames.test(file) && !testSupport.has(file)
    return chosen ? [file] : []
  })

const missedOf = (mutants) => mutants.filter(({ status }) => status === "Survived" || status === "NoCoverage")

const byPosition = (left, right) =>
  left.fileName.localeCompare(right.fileName) ||
  left.location.start.line - right.location.start.line ||
  left.location.start.column - right.location.start.column

export const survivorLines = (mutants) =>
  missedOf(mutants)
    .toSorted(byPosition)
    .map(({ fileName, location, mutatorName }) => `survived ${fileName}:${location.start.line} ${mutatorName}`)

export const totalLine = (mutants) => {
  const count = (...statuses) => mutants.filter(({ status }) => statuses.includes(status)).length
  return `mutants ${mutants.length}  killed ${count("Killed")}  survived ${count("Survived")}  no-coverage ${count("NoCoverage")}  timeout ${count("Timeout")}  errors ${count("CompileError", "RuntimeError")}`
}

const sourcePattern = (target) => {
  const relative = path.relative(root, path.resolve(root, target)).split(path.sep).join("/")
  return statSync(path.join(root, relative)).isDirectory() ? `${relative}/**/*.ts` : relative
}

const runMutants = async (targets) => {
  const { Stryker } = await import("@stryker-mutator/core")
  process.chdir(root)
  return new Stryker({
    mutate: [...targets.map(sourcePattern), "!**/*.test.ts"],
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
}

const relativeToRoot = (mutant) => ({ ...mutant, fileName: path.relative(root, mutant.fileName) })

const reportChanged = async (base) => {
  const nameStatus = execFileSync("git", ["diff", "--name-status", "--no-renames", `${base}...HEAD`], {
    cwd: root,
    encoding: "utf8",
  })
  const files = changedSources(nameStatus)
  if (files.length === 0) {
    console.log(`No source file to mutate changed since ${base}.`)
    return
  }
  console.log(`mutating ${files.length} changed: ${files.join(" ")}`)
  const started = Date.now()
  const mutants = (await runMutants(files)).map(relativeToRoot)
  if (mutants.length === 0) console.log("No mutant ran: no test imports these files, or they hold no code to mutate.")
  for (const line of survivorLines(mutants)) console.log(line)
  console.log(`${totalLine(mutants)}  seconds ${Math.round((Date.now() - started) / 1000)}`)
}

const reportTargets = async (targets) => {
  const mutants = await runMutants(targets.length > 0 ? targets : mutatedPackages)

  if (mutants.length === 0) {
    console.error("Nothing to mutate there. Name a source file or a package folder, not a test.")
    process.exit(1)
  }

  const missed = missedOf(mutants)

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

  console.log(`metric ${metricName}  now ${missed.length}  goal 0`)
  for (const mutant of missed.toSorted(byPosition).slice(0, listedSurvivors))
    console.log(
      `${position(mutant)}  ${original(mutant)} -> ${oneLine(mutant.replacement ?? "")}${mutant.status === "NoCoverage" ? "  (no test runs this line)" : ""}`,
    )
  if (missed.length > listedSurvivors) console.log(`and ${missed.length - listedSurvivors} more`)
  console.log(totalLine(mutants))
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const [first, base] = process.argv.slice(2)
  if (first !== changedFlag) await reportTargets(process.argv.slice(2))
  else if (base === undefined) {
    console.error(`${changedFlag} needs a base commit.`)
    process.exit(1)
  } else await reportChanged(base)
}
