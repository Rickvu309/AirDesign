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

const workflow = parse(fs.readFileSync(path.join(root, ".github/workflows/closed-branch.yml"), "utf8"))
const job = workflow.jobs["closed-branch"]
const [step] = job.steps

same("it runs when a pull request closes and at no other time", workflow.on, {
  pull_request_target: { types: ["closed"] },
})
same("it may write branches and nothing else", workflow.permissions, { contents: "write" })
for (const kept of [
  "github.event.pull_request.merged == false",
  "github.event.pull_request.head.repo.full_name == github.repository",
  "github.event.pull_request.head.ref != 'main'",
  "!startsWith(github.event.pull_request.head.ref, 'archive/')",
]) {
  same(`it only runs when ${kept}`, job.if.includes(kept), true)
}
same("it stops itself after two minutes", job["timeout-minutes"], 2)
same("it has one step", job.steps.length, 1)
same("the branch name reaches the shell as a value", step.env.BRANCH, "${{ github.event.pull_request.head.ref }}")
same("the command never holds the branch name itself", step.run.includes("${{"), false)
same(
  "it deletes that branch",
  step.run.includes('gh api -X DELETE "repos/$GITHUB_REPOSITORY/git/refs/heads/$BRANCH"'),
  true,
)
