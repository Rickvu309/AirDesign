import fs from "node:fs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}
const read = (file) => fs.readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), "utf8")
const bar = read("bar.yml")
const countersign = read("countersign.yml")

same("bar reports on the merge queue's commit, so it can be a required check", /^ {2}merge_group:/m.test(bar), true)
same(
  "two merge groups never cancel each other's bar run",
  bar.includes("group: bar-${{ github.event.pull_request.number || github.run_id }}"),
  true,
)
same(
  "a comment on a pull request starts the countersign workflow",
  /issue_comment:\s+types:\s+- created/.test(countersign),
  true,
)
same(
  "only the owner and collaborators can countersign the public repository",
  countersign.includes(
    `contains(fromJSON('["OWNER", "MEMBER", "COLLABORATOR"]'), github.event.comment.author_association)`,
  ),
  true,
)
same("the comment's text never reaches a shell", countersign.includes("comment.body }}"), false)
same("it runs the bar check again on the pull request's head", countersign.includes('gh run rerun "$run"'), true)
same("and may do nothing else with actions", countersign.includes("actions: write"), true)

console.log("countersign workflow tests passed")
