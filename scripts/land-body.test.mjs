import { fixture, harness, same } from "./land-harness.mjs"

const generated = "🤖 Generated with [Claude Code](https://claude.com/claude-code)"
const pull645 = fixture("pr-645-body.md")
same("the fixture is PR 645's body with its attribution line", pull645.includes(`\n${generated}\n`), true)
const attributed = harness({
  pull: null,
  bodyText: pull645,
  args: ["--title", "Add land", "--body-file", "/tmp/body.md"],
})
same("a body file with a Generated with line stops", await attributed.run(), 1)
same("before the check", attributed.log.includes("stamp"), false)
same(
  "and before the push",
  attributed.log.some((line) => line.startsWith("git push")),
  false,
)
same(
  "it names the line, the file and says to delete it",
  attributed.said.at(-1),
  `STOPPED at body: /tmp/body.md has the attribution line "${generated}". Delete that line, then run pnpm land again.`,
)
const prAttributed = harness({
  pull: { number: 645, baseRefName: "main", url: "u", title: "Add land", body: pull645.replaceAll("\n", "\r\n") },
})
same("an open pull request whose body has a Generated with line stops", await prAttributed.run(), 1)
same("before the check", prAttributed.log.includes("stamp"), false)
same(
  "it names the pull request, the line and how to edit the body",
  prAttributed.said.at(-1),
  `STOPPED at body: the body of pull request 645 has the attribution line "${generated}". Delete that line: write the body to a file without it and run pnpm land --body-file <file>.`,
)
const editedAttributed = harness({
  bodyText: pull645,
  args: ["--body-file", "/tmp/body.md"],
})
same("a --body-file that would edit an open pull request's body stops on the line", await editedAttributed.run(), 1)
same(
  "and edits nothing",
  editedAttributed.log.some((line) => line.startsWith("gh api -X PATCH")),
  false,
)
same(
  "it names the file",
  editedAttributed.said.at(-1),
  `STOPPED at body: /tmp/body.md has the attribution line "${generated}". Delete that line, then run pnpm land again.`,
)
same(
  "a body that only mentions Claude Code passes",
  await harness({
    pull: null,
    bodyText: "**Now:** A.\n**Proof:** Ran the land test with Claude Code's output.\n",
    args: ["--title", "Add land", "--body-file", "/tmp/body.md", "--check"],
  }).run(),
  0,
)
