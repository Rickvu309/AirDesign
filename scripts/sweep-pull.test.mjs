import { harness, pullAnswer, same } from "./land-harness.mjs"

const clean = harness()
same("a clean branch lands", await clean.run(), 0)
same("and land sweeps that pull request", clean.swept, [{ branch: "land-command", number: 394 }])

const rooted = harness()
rooted.context.root = "/repo"
rooted.context.sweepPull = (asked) => {
  rooted.swept.push({ root: asked.root, branch: asked.branch, number: asked.number })
}
same("land reaches the sweep from the checkout it was given", await rooted.run(), 0)
same("and names that checkout", rooted.swept, [{ root: "/repo", branch: "land-command", number: 394 }])

const conflicted = harness({ conflicts: "apps/web/src/thin-deck.tsx" })
same("a conflict sweeps nothing", await conflicted.run(), 1)
same("the sweep was not asked", conflicted.swept, [])

const watch = harness({ args: ["--watch"], reads: [pullAnswer({ merged: true })] })
same("--watch follows to merged", await watch.run(), 0)
same("--watch sweeps that pull request", watch.swept, [{ branch: "land-command", number: 394 }])

const watchedByNumber = harness({
  args: ["--watch", "--pr", "394"],
  branch: "main",
  pull: { number: 394, baseRefName: "main", url: "u", headRefName: "speed-fix" },
  reads: [pullAnswer({ merged: true })],
})
same("--watch --pr follows that pull request", await watchedByNumber.run(), 0)
same("--watch --pr sweeps the pull request branch", watchedByNumber.swept, [{ branch: "speed-fix", number: 394 }])

const openedOnly = harness({ args: ["--no-follow"] })
same("--no-follow returns before the merge is confirmed", await openedOnly.run(), 0)
same("--no-follow sweeps nothing", openedOnly.swept, [])

const status = harness({ args: ["--status"], reads: [pullAnswer({ armed: true })] })
same("--status changes nothing", await status.run(), 0)
same("--status sweeps nothing", status.swept, [])

console.log("sweep pull tests passed")
