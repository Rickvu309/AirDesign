import { land, parseArgs } from "./land.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}
const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" })

const landWith = async ({ body, pullBody, changedFiles = "", args = ["--check"] }) => {
  const said = []
  const git = (command) => {
    const [name] = command
    if (name === "rev-parse") return ok("work\n")
    if (name === "status" || name === "fetch" || name === "cat-file" || name === "merge-base") return ok()
    if (name === "diff") return ok(command.includes("--name-only") ? changedFiles : "")
    if (name === "merge-tree") return { status: 1, stdout: "tree\nAGENTS.md\n\nCONFLICT\n", stderr: "" }
    throw new Error(`unexpected git ${command.join(" ")}`)
  }
  const pull =
    pullBody === undefined ? [] : [{ number: 7, baseRefName: "main", url: "u", title: "Add land", body: pullBody }]
  const gh = (command) => {
    if (command[0] === "pr" && command[1] === "list") return ok(JSON.stringify(pull))
    throw new Error(`unexpected gh ${command.join(" ")}`)
  }
  const code = await land({
    args: parseArgs(body === undefined ? args : [...args, "--body-file", "body.md"]),
    git,
    gh,
    repository: "Rickvu309/AirDesign",
    read: () => {
      throw new Error("no read")
    },
    readText: () => body,
    check: async () => {
      throw new Error("the check ran")
    },
    stamp: () => {},
    say: (line) => said.push(line),
  })
  return { code, said, stoppedAt: said.find((line) => line.startsWith("STOPPED")) ?? "" }
}

const placeholder = await landWith({ body: "## What changes\n\nA.\n\n## Before / after\n\nPUBLISHED_IMAGES\n" })
same("a body file that still holds a placeholder stops land", placeholder.code, 1)
same(
  "at the body, before the check, naming the line and the placeholder",
  placeholder.stoppedAt.startsWith("STOPPED at body: line 7 still holds the placeholder PUBLISHED_IMAGES"),
  true,
)

const unshown = await landWith({
  pullBody: "## Proof\n\nRan it.\n",
  changedFiles: "apps/web/src/editor/format-buttons.tsx\nscripts/land.mjs\n",
})
same(
  "an open pull request that changes what a person sees with no Before / after stops at the body",
  unshown.stoppedAt.startsWith("STOPPED at body:"),
  true,
)
same(
  "and names the file and the no-visible-change line",
  unshown.stoppedAt.includes("apps/web/src/editor/format-buttons.tsx") &&
    unshown.stoppedAt.includes("No visible change: <why>"),
  true,
)

const unseen = await landWith({
  pullBody:
    "## Proof\n\nRan it.\n\n## Before / after\n\nNo visible change: moves code between files; the toolbar paints the same.\n",
  changedFiles: "apps/web/src/editor/format-buttons.tsx\n",
})
same("a written no-visible-change line passes the body step", unseen.stoppedAt.startsWith("STOPPED at conflicts"), true)

const unjudged = await landWith({})
same("--check with no body goes on past the body step", unjudged.stoppedAt.startsWith("STOPPED at conflicts"), true)
same(
  "and says the body was not judged",
  unjudged.said.some((line) => line.startsWith("body") && line.includes("--body-file")),
  true,
)
