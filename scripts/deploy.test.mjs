import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

same(
  "the site and web deploys share one workflow file",
  fs.existsSync(path.join(root, ".github/workflows/deploy.yml")),
  true,
)
same(
  "the old site-only workflow file is gone",
  fs.existsSync(path.join(root, ".github/workflows/deploy-site.yml")),
  false,
)

const workflow = fs.readFileSync(path.join(root, ".github/workflows/deploy.yml"), "utf8")

const steps = workflow
  .split(/^ {4}steps:\n/m)[1]
  .split(/^ {6}- /m)
  .slice(1)
same("the job has steps", steps.length > 0, true)
for (const step of steps) {
  same(`the step cannot fail the job: ${step.split("\n")[0]}`, step.includes("continue-on-error: true"), true)
}
same("the job stops itself after fifteen minutes", /^ {4}timeout-minutes: 15$/m.test(workflow), true)
same(
  "the workflow runs after ci completes on main",
  /^ {2}workflow_run:\n {4}workflows:\n {6}- ci\n {4}types:\n {6}- completed\n {4}branches:\n {6}- main$/m.test(
    workflow,
  ),
  true,
)
same(
  "the job runs only for a push that passed ci",
  workflow.includes(
    "if: github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push'",
  ),
  true,
)
same(
  "the matrix holds the site, the web app and the API, and one failing deploy does not stop the others",
  /^ {4}strategy:\n {6}fail-fast: false\n {6}matrix:\n {8}include:\n {10}- app: site\n {12}directory: apps\/site\n {12}what: Site\n {10}- app: web\n {12}directory: apps\/web\n {12}what: Web app\n {10}- app: api\n {12}directory: \.\n {12}what: API$/m.test(
    workflow,
  ),
  true,
)
same(
  "each app has its own deploy queue and two deploys of one app cannot race",
  /^ {4}concurrency:\n {6}group: deploy-\$\{\{ matrix\.app \}\}\n {6}cancel-in-progress: false$/m.test(workflow),
  true,
)
same(
  "the workflow reads actions, writes the green branch and writes issues",
  /^permissions:\n {2}actions: read\n {2}contents: write\n {2}issues: write$/m.test(workflow),
  true,
)
same(
  "the job checks out main, where the decision script lives, with the history it needs",
  workflow.includes("ref: main") && workflow.includes("fetch-depth: 0"),
  true,
)
same("the deploy checks out the chosen commit", workflow.includes('git checkout --detach "$SHA"'), true)
same("a run never skips because main moved", workflow.includes("main moved to"), false)
same("the API moves the green branch without force", workflow.includes("node scripts/deploy-commit.mjs --apply"), true)
same("a git push in the workflow is never forced", /git push[^\n]*--force/.test(workflow), false)
same("the web app publishes the chosen commit for the journey", workflow.includes("name: deployed-commit"), true)
same("each deploy runs in its own app folder", workflow.includes("working-directory: ${{ matrix.directory }}"), true)

const inRun = steps.map((step) => step.split(/^ {8}run: \|\n/m)[1] ?? "").join("\n")
same("no run script reads the event", /\$\{\{/.test(inRun), false)

const secretLines = workflow.split("\n").filter((line) => line.includes("secrets."))
same(
  "only the deploy step receives the Cloudflare secrets",
  secretLines.map((line) => line.trim()),
  [
    "CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
    "CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
  ],
)
const deployStep = steps.find((step) => step.startsWith("id: deploy"))
same(
  "the secrets sit in the deploy step",
  secretLines.every((line) => deployStep.includes(line.trim())),
  true,
)
same("a secret is never echoed", /echo[^\n]*(CLOUDFLARE|secrets\.)/.test(workflow), false)
same(
  "the alarm is a red-deploy issue named for the app that failed",
  workflow.includes('title="$WHAT deploy is red"') &&
    workflow.includes('label="$APP-deploy-red"') &&
    workflow.includes('gh issue create --title "$title" --label "$label" --body "$line"'),
  true,
)
same("the alarm never uses the smoke label", /label[ =]"?deploy-red\b/.test(workflow), false)
same(
  "the alarm finds its issue by the app's own label",
  workflow.includes('gh issue list --label "$label" --state open'),
  true,
)
same("the alarm never uses the smoke title", workflow.includes("Deploy or smoke check is red"), false)
same("a deployed app closes its own issue", workflow.includes('gh issue close "$open"'), true)
same("the workflow does not swallow a failure with || true", workflow.includes("|| true"), false)

const railway = fs.readFileSync(path.join(root, ".railway/railway.ts"), "utf8")
same(
  "the api follows the green branch without waiting for check suites, because Railway skips the deployment when any workflow on the commit fails",
  /github\("Rickvu309\/AirDesign", \{ branch: "green", checkSuites: false \}\)/.test(railway),
  true,
)
for (const folder of ["apps/site", "apps/web"]) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, folder, "package.json"), "utf8"))
  same(
    `${folder} stamps the deployed commit and keeps the vars already on Cloudflare`,
    pkg.scripts.deploy,
    "pnpm build && wrangler deploy --keep-vars --var COMMIT:$(git rev-parse HEAD)",
  )
}
same("the api deploys every commit, so no watch path can skip one", /watchPatterns/.test(railway), false)

const journey = parse(fs.readFileSync(path.join(root, ".github/workflows/production-journey.yml"), "utf8"))
const journeyJob = journey.jobs["production-journey"]
const journeySteps = journeyJob.steps
same("the production journey runs after each successful deploy and waits for the deployed commit", journey.on, {
  workflow_dispatch: null,
  workflow_run: { workflows: ["deploy"], types: ["completed"], branches: ["main"] },
})
same(
  "the production journey runs only after a deploy that succeeded, or by hand",
  journeyJob.if,
  "github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'",
)
const wanted = journeySteps[0]
same(
  "the journey reads the commit the deploy run published",
  [wanted.id, wanted.env.EVENT, wanted.env.RUN],
  ["wanted", "${{ github.event_name }}", "${{ github.event.workflow_run.id }}"],
)
same(
  "a dispatched journey uses the tip and a deploy journey uses the published commit",
  wanted.run.includes('"$EVENT" = "workflow_dispatch"') &&
    wanted.run.includes("gh run download") &&
    wanted.run.includes("deployed-commit"),
  true,
)
same("the production journey tests the deployed commit", journeySteps[1].with, {
  ref: "${{ steps.wanted.outputs.sha }}",
  "fetch-depth": 0,
})
const waitStep = journeySteps.findIndex((step) => (step.run ?? "").includes("scripts/production-commit.mjs"))
same(
  "the production journey waits until the web app and the API serve the deployed commit before it runs",
  waitStep !== -1 && waitStep < journeySteps.findIndex((step) => step.run === "pnpm test:production"),
  true,
)
same(
  "the wait reads the deployed commit from its environment, not the event",
  [journeySteps[waitStep].env?.WANTED, journeySteps[waitStep].run, /\$\{\{/.test(journeySteps[waitStep].run)],
  ["${{ steps.wanted.outputs.sha }}", 'node scripts/production-commit.mjs "$WANTED" web api', false],
)
same("the journey can read the deploy run's artifact", journey.permissions.actions, "read")
same("deploys in a row queue their journeys", journey.concurrency, {
  group: "production-journey",
  "cancel-in-progress": false,
})
const alarm = journeySteps.find((step) => (step.run ?? "").includes("red-main.sh"))
same(
  "a failed journey after a deploy opens or comments on its issue",
  [alarm?.if, alarm?.env?.RED_TITLE, journey.permissions.issues],
  ["failure() && github.event_name == 'workflow_run'", "production journey failed", "write"],
)
