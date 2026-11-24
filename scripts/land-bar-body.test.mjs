import { harness, same } from "./land-harness.mjs"

const ran = (run, start) => run.log.some((line) => line.startsWith(start))
const oldHeadBody = "## Summary\n\nA.\n\n## Evidence\n\nMeasured at ed84dea7: 12 tests pass.\n"
const staleBody = harness({
  pull: { number: 412, baseRefName: "main", url: "u", title: "Add land", body: "## Proof\n" },
  bodyText: oldHeadBody,
  offBranch: ["ed84dea7"],
  args: ["--body-file", "/tmp/body.md"],
})
same("a body naming an old head's hash stops land before the gate", await staleBody.run(), 1)
same(
  "and names the line and the commit",
  staleBody.said.some((line) => line.includes("line 7 names commit ed84dea7")),
  true,
)
same(
  "and edits and pushes nothing",
  [staleBody.edits, ran(staleBody, "git push"), staleBody.log.includes("stamp")],
  [[], false, false],
)

const unshown = harness({
  pull: { number: 412, baseRefName: "main", url: "u", title: "Add land", body: "## Proof\n" },
  changed: "apps/web/src/editor/canvas.tsx\n",
  args: ["--body-file", "/tmp/body.md"],
})
same("a visible change with no Before / after stops land before the gate", await unshown.run(), 1)
same(
  "and says what to add",
  unshown.said.some((line) => line.includes("has no ## Before / after")),
  true,
)
same("and edits and pushes nothing", [unshown.edits, ran(unshown, "git push")], [[], false])
