import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const workflow = fs.readFileSync(path.join(root, ".github/workflows/deploy-site.yml"), "utf8")

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
  "two deploys cannot race",
  /^concurrency:\n {2}group: deploy-site\n {2}cancel-in-progress: false$/m.test(workflow),
  true,
)
same(
  "the workflow reads the code and writes issues",
  /^permissions:\n {2}contents: read\n {2}issues: write$/m.test(workflow),
  true,
)
same(
  "the deploy publishes only the commit ci passed",
  workflow.includes("ref: ${{ github.event.workflow_run.head_sha }}"),
  true,
)
same(
  "the deploy skips a commit that is no longer the tip of main",
  workflow.includes('if [ "$tip" != "$HEAD_SHA" ]'),
  true,
)

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
  "the alarm is a deploy-red issue with its own title",
  workflow.includes('gh issue create --title "$title" --label site-deploy-red --body') &&
    workflow.includes('title="Site deploy is red"'),
  true,
)
same("the alarm never uses the smoke label", /--label deploy-red/.test(workflow), false)
same(
  "the alarm finds its issue by its own label",
  workflow.includes("gh issue list --label site-deploy-red --state open"),
  true,
)
same("the alarm never uses the smoke title", workflow.includes("Deploy or smoke check is red"), false)
same("a deployed site closes its own issue", workflow.includes('gh issue close "$open"'), true)
same("no path gate keeps a commit from deploying", /apps\/site packages\/theme|git diff/.test(workflow), false)
same("the workflow does not swallow a failure with || true", workflow.includes("|| true"), false)
