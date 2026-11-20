import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { changeMap, checkJobsFor, ciParts, decide, readChangeGraph } from "./change-map.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const on = (result) => ciParts.filter((part) => result.parts[part])

const toy = {
  packages: [
    { name: "@airdesign/document", dir: "packages/document", deps: [] },
    { name: "@airdesign/pptx", dir: "packages/pptx", deps: ["@airdesign/document"] },
    { name: "@airdesign/oauth", dir: "packages/oauth", deps: [] },
    { name: "@airdesign/api", dir: "apps/api", deps: ["@airdesign/document", "@airdesign/oauth"] },
    { name: "@airdesign/site", dir: "apps/site", deps: [] },
    { name: "web", dir: "apps/web", deps: ["@airdesign/document", "@airdesign/pptx"] },
    { name: "@airdesign/boundary-fetch", dir: "tooling/boundary-fixtures/fetch-in-document", deps: [] },
  ],
  imports: {
    "vitest.config.mts": ["scripts/vitest-metrics.mjs"],
    "scripts/vitest-metrics.mjs": ["scripts/longest-first.mjs"],
    "tests/browser/home.spec.ts": ["web", "scripts/slide-export.mjs"],
    "tests/browser/design-states.spec.ts": [
      "tests/browser/open-screen.ts",
      ".agents/skills/verify-airdesign/look/scan.mjs",
    ],
    ".agents/skills/verify-airdesign/look/scan.mjs": [".agents/skills/verify-airdesign/look/walk.mjs"],
    ".agents/skills/verify-airdesign/look/walk.mjs": [".agents/skills/verify-airdesign/journeys/theme.mjs"],
    "tests/edit-replay.test.ts": ["@airdesign/document", "tests/spec-graph.ts"],
    "unit:apps/web/": ["tests/spec-graph.ts"],
    "scripts/pptx-check.mjs": ["@airdesign/pptx"],
    "tests/journeys/journeys.spec.ts": ["gone:scripts/stored-zip"],
  },
  journeyNames: ["account-name", "theme"],
  pptxPaths: ["packages/pptx", "packages/document", "scripts/pptx-check.mjs"],
}

const map = (changed, options) => changeMap(changed, toy, options)
const reading = {
  ...toy,
  reads: {
    "scripts/deploy.test.mjs": [".railway/railway.ts"],
    "scripts/land.test.mjs": ["apps/web/src/thin-deck.tsx"],
    "scripts/check-specs.test.mjs": ["specs/edit/"],
  },
}
const mapReading = (changed) => changeMap(changed, reading)

same(
  "a file a script test reads runs the script tests though it is source only and nothing imports it",
  [on(map([".railway/railway.ts"])), on(mapReading([".railway/railway.ts"]))],
  [["source"], ["source", "scripts"]],
)
same(
  "a file in an app that a script test reads keeps its own parts and adds the script tests",
  on(mapReading(["apps/web/src/thin-deck.tsx"])),
  ["source", "scripts", "design", "browser", "journeys"],
)
same(
  "a file under a folder a script test reads runs the script tests, and its neighbour in another folder does not",
  [on(mapReading(["specs/edit/Edit.tla"])), on(mapReading(["specs/run/Run.tla"]))],
  [
    ["source", "scripts", "model-check"],
    ["source", "model-check"],
  ],
)

same(
  "a change to packages/document runs its own tests and every package that imports it, since document imports nothing and everything imports it",
  map(["packages/document/src/slide.ts"]).unitTests,
  ["apps/api/", "apps/web/", "packages/document/", "packages/pptx/", "tests/"],
)
same(
  "a package nobody imports runs only its own tests and the parts its importers feed",
  map(["packages/oauth/src/grant.ts"]).unitTests,
  ["apps/api/", "packages/oauth/"],
)
same(
  "the api is served to the browser, design and journeys parts, so a change under a package the api imports runs them",
  on(map(["packages/oauth/src/grant.ts"])),
  ["source", "design", "browser", "journeys"],
)
same(
  "the site is served only to the browser part and built by the scripts part, since the design scans read web screens",
  on(map(["apps/site/src/pages/index.astro"])),
  ["source", "scripts", "browser"],
)
same(
  "a package's own test file runs only that package's tests, since no app code imports a test",
  [on(map(["apps/web/src/editor.test.tsx"])), map(["apps/web/src/editor.test.tsx"]).unitTests],
  [["source"], ["apps/web/"]],
)
same(
  "a file outside the packages reaches the tests that import it, including a package's tests",
  map(["tests/spec-graph.ts"]).unitTests,
  ["apps/web/", "tests/"],
)
same("a browser spec runs the browser part alone", on(map(["tests/browser/home.spec.ts"])), ["source", "browser"])
same("a design scan runs the design part alone", on(map(["tests/browser/design-states.spec.ts"])), ["source", "design"])
same("browser, design and PowerPoint load the browser launch", on(map(["tests/browser/launch.ts"])), [
  "source",
  "design",
  "browser",
  "pptx",
  "corpus",
])
same(
  "a script a browser spec imports runs the browser part as well as the script tests",
  on(map(["scripts/slide-export.mjs"])),
  ["source", "scripts", "browser"],
)
same(
  "a deleted file reaches the files that still import it, so a dangling import breaks where it shows",
  on(map(["scripts/stored-zip.mjs"])),
  ["source", "scripts", "journeys"],
)
same("a script nothing else imports runs only the script tests", on(map(["scripts/land.mjs"])), ["source", "scripts"])
same(
  "a journey runs journeys, and design too when a look state walks it",
  on(map([".agents/skills/verify-airdesign/journeys/theme.mjs"])),
  ["source", "design", "journeys"],
)
same(
  "a journey nothing walks runs only journeys",
  on(map([".agents/skills/verify-airdesign/journeys/account-name.mjs"])),
  ["source", "journeys"],
)
same(
  "select the changed journeys even when design also walks one of them",
  map([
    ".agents/skills/verify-airdesign/journeys/theme.mjs",
    ".agents/skills/verify-airdesign/journeys/account-name.mjs",
  ]).journeyNames,
  ["account-name", "theme"],
)
for (const file of [
  "apps/web/src/editor.tsx",
  "apps/site/src/pages/index.astro",
  "tests/journeys/launch.ts",
  ".agents/skills/verify-airdesign/journeys/deleted.mjs",
]) {
  same(
    `a change to ${file} alongside a journey keeps every journey`,
    map([file, ".agents/skills/verify-airdesign/journeys/theme.mjs"]).journeyNames,
    "all",
  )
}
same("tests/journeys runs journeys", on(map(["tests/journeys/journeys.spec.ts"])), ["source", "journeys"])
same(
  "a TLA+ spec runs model-check and the replay tests in tests/, and no browser part",
  [on(map(["specs/run/Run.tla"])), map(["specs/run/Run.tla"]).unitTests],
  [["source", "model-check"], ["tests/"]],
)
same(
  "a doc is inert to every test part; source and scripts still run, since file-growth, rule-rows and the script tests read docs",
  [on(map(["GLOSSARY.md"])), on(map(["scripts/land.rule.md"])), on(map(["packages/document/README.md"]))],
  [
    ["source", "scripts"],
    ["source", "scripts"],
    ["source", "scripts", "pptx", "corpus"],
  ],
)
same(
  "pptx and corpus follow .github/actions/ci-changes/pptx-paths.txt, the one list",
  [on(map(["scripts/pptx-check.mjs"])), on(map(["packages/oauth/src/grant.ts"])).includes("pptx")],
  [["source", "scripts", "pptx", "corpus"], false],
)
same(
  "a boundary fixture is a package the script tests read, so it runs scripts and no app part",
  on(map(["tooling/boundary-fixtures/fetch-in-document/src/index.ts"])),
  ["source", "scripts"],
)
same("the skill folders under .claude are links to .agents and run nothing", on(map([".claude/skills/x/SKILL.md"])), [])
same("no change runs nothing", on(map([])), [])

const everything = (name, changed, options) => same(name, map(changed, options).everything, true)
everything("the lockfile runs everything", ["pnpm-lock.yaml"])
everything("any package.json runs everything, since it can change dependencies every package reads", [
  "apps/web/package.json",
])
everything("CI config runs everything", [".github/workflows/ci.yml"])
everything("a CI-only doc under .github runs everything, since the bar and pr-body checks read it", [
  ".github/pull_request_template.md",
])
everything("the check runner runs everything", ["scripts/check-steps.mjs"])
everything("this map runs everything, since it decides what runs", ["scripts/change-map.mjs"])
everything("a file the unit test setup reaches runs everything", ["scripts/longest-first.mjs"])
everything("a path nobody owns runs everything", ["newfolder/thing.ts"])
everything("a diff that cannot be read runs everything", null)
everything("--full runs everything, for pushes to main", ["GLOSSARY.md"], { full: true })
same("a run of everything runs every unit test", map(null).unitTests, "all")

const scope = (changed) =>
  changeMap(changed, {
    ...toy,
    imports: {
      ...toy.imports,
      "tests/browser/home.spec.ts": ["tests/browser/fixtures/index.ts"],
      "tests/browser/fixtures/index.ts": ["tests/browser/fixtures/sky.ts"],
      "tests/browser/fixtures/sky.ts": ["tests/browser/fixtures/index.ts", "gone:tests/browser/fixtures/removed"],
      "tests/browser/guest.spec.ts": ["tests/browser/home.spec.ts"],
    },
    browserSpecs: ["tests/browser/home.spec.ts", "tests/browser/guest.spec.ts", "tests/browser/unrelated.spec.ts"],
    browserSeconds: { "home.spec.ts": 70, "guest.spec.ts": 80, "unrelated.spec.ts": 40 },
    exportSpecs: ["tests/browser/home.spec.ts"],
  })
const homeAndGuest = ["tests/browser/guest.spec.ts", "tests/browser/home.spec.ts"]
for (const changed of [
  "tests/browser/home.spec.ts",
  "tests/browser/fixtures/sky.ts",
  "tests/browser/fixtures/removed.ts",
]) {
  const result = scope([changed])
  same(`${changed} reaches its direct and transitive importers`, result.browserSpecs, homeAndGuest)
  same(`${changed} reaches the export spec`, on(result), ["source", "browser", "pptx", "corpus"])
  same(
    `${changed} fits in two time-weighted jobs`,
    checkJobsFor(
      result,
      [1, 2, 3, 4].map((n) => ({ part: "browser", shard: `${n}/4` })),
    ),
    [
      { part: "browser", shard: "1/2", browserSpecs: ["tests/browser/guest.spec.ts"] },
      { part: "browser", shard: "2/2", browserSpecs: ["tests/browser/home.spec.ts"] },
    ],
  )
}
same(
  "a change to app code alongside a spec runs the full browser suite",
  scope(["apps/web/src/editor.tsx", "tests/browser/home.spec.ts"]).browserSpecs,
  "all",
)
same(
  "a change to a Playwright setting runs the full browser suite",
  scope(["playwright.config.ts"]).browserSpecs,
  "all",
)
same(
  "an unclaimed browser fixture runs the full browser suite",
  scope(["tests/browser/fixtures/unknown.pptx"]).browserSpecs,
  "all",
)
same("an unrelated spec skips PowerPoint", on(scope(["tests/browser/unrelated.spec.ts"])), ["source", "browser"])

const graph = readChangeGraph(root)
const real = (changed) => changeMap(changed, graph)

same(
  "every workspace package is in the graph, read from pnpm-workspace.yaml and the manifests",
  graph.packages.map((pkg) => pkg.dir).sort(),
  fs
    .readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8")
    .match(/^packages:\n((?:\s+-.*\n)+)/m)[1]
    .split("\n")
    .filter(Boolean)
    .map((line) => line.replace(/^\s+-\s+["']?|["']$/g, ""))
    .flatMap((pattern) =>
      fs
        .readdirSync(path.join(root, pattern.slice(0, -2)))
        .map((name) => `${pattern.slice(0, -2)}/${name}`)
        .filter((dir) => fs.existsSync(path.join(root, dir, "package.json"))),
    )
    .sort(),
)
same(
  "packages/document imports no package, so the graph does real work",
  graph.packages.find((pkg) => pkg.dir === "packages/document").deps,
  [],
)
same(
  "the real pptx list is the one in .github/actions/ci-changes/pptx-paths.txt",
  graph.pptxPaths,
  fs.readFileSync(path.join(root, ".github/actions/ci-changes/pptx-paths.txt"), "utf8").split("\n").filter(Boolean),
)
same(
  "in the repo, a look state reaches design, since design-states loads the look scan",
  real([".agents/skills/verify-airdesign/look/scan.mjs"]).parts.design,
  true,
)
same(
  "in the repo, the browser launch reaches the browser part through playwright.config.ts",
  real(["tests/browser/launch.ts"]).parts.browser,
  true,
)
same("in the repo, a vitest setup file runs everything", real(["scripts/vitest-metrics.mjs"]).everything, true)
same("in the repo, the PR body check is a script alone", on(real(["scripts/pr-body.mjs"])), ["source", "scripts"])
same("in the repo, the oauth package runs no pptx part", real(["packages/oauth/src/index.ts"]).parts.pptx, false)
same(
  "in the repo, a file a script test reads turns on the script tests even when no import links them",
  [".oxfmtrc.json", ".railway/railway.ts", "specs/edit/Edit.tla", "tests/browser/preview-port.ts"].map(
    (file) => real([file]).parts.scripts,
  ),
  [true, true, true, true],
)
same(
  "in the repo, a doc and a workflow that script tests read turn them on",
  ["AGENTS.md", ".github/workflows/ci.yml"].map((file) => real([file]).parts.scripts),
  [true, true],
)

const jobs = JSON.stringify([{ part: "source" }, { part: "browser", shard: "1/2" }, { part: "browser", shard: "2/2" }])
const said = (argv) =>
  Object.fromEntries(decide(["--jobs", jobs, ...argv], root).lines.map((line) => line.split(/=(.*)/s)))
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-change-map-"))
process.on("exit", () => fs.rmSync(scratch, { recursive: true, force: true }))
const listedIn = (paths) => {
  const file = path.join(scratch, `paths-${String(paths.length)}-${path.basename(paths[0] ?? "none")}`)
  fs.writeFileSync(file, `${paths.join("\n")}\n`)
  return file
}
same(
  "the command prints one line per part, the unit test folders as JSON, and the check jobs whose part runs",
  said(["--paths", listedIn(["tests/browser/home.spec.ts"])]),
  {
    source: "true",
    scripts: "false",
    design: "false",
    browser: "true",
    journeys: "false",
    pptx: "false",
    corpus: "false",
    "model-check": "false",
    "journey-names": "",
    "unit-tests": "[]",
    check: JSON.stringify([{ part: "source" }, { part: "browser", browserSpecs: ["tests/browser/home.spec.ts"] }]),
  },
)
const connectorJourney = ".agents/skills/verify-airdesign/journeys/connector-follow.mjs"
same(
  "the workflow gets the connector journey and the agent bench that reaches its look states, while design still runs",
  [said(["--paths", listedIn([connectorJourney])])["journey-names"], real([connectorJourney]).parts.design],
  ['["agent-bench-recorded","connector-follow"]', true],
)
same(
  "an account journey change selects just that journey",
  real([".agents/skills/verify-airdesign/journeys/account-name.mjs"]).journeyNames,
  ["account-name"],
)
same(
  "a docs change keeps only the source job",
  said(["--paths", listedIn(["GLOSSARY.md"])]).check,
  JSON.stringify([{ part: "source" }]),
)
for (const [name, argv] of [
  ["no list of paths, which is what an unreadable diff gives", []],
  ["--full", ["--full", "--paths", listedIn(["GLOSSARY.md"])]],
  ["a list that cannot be read", ["--paths", "/nowhere/paths"]],
]) {
  const out = said(argv)
  same(
    `${name} runs every part, every job and every unit test`,
    [ciParts.every((part) => out[part] === "true"), out.check, out["unit-tests"]],
    [true, jobs, "all"],
  )
}
same(
  "the reason for running everything is printed for the log",
  decide(["--jobs", jobs, "--paths", "/nowhere/paths"], root).said[0].startsWith("every part runs: the map failed:"),
  true,
)
