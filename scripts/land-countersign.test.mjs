import { harness, same } from "./land-harness.mjs"

const head = "e".repeat(40)
const waiting = harness()
waiting.context.countersign = ({ number }) => ({
  pass: false,
  line: `Needs a countersign for pull request ${number} at ${head}.`,
})
same("a pull request that lowers the bar is armed and land ends without following it", await waiting.run(), 0)
same(
  "auto-merge is armed, so the queue takes it once the bar check passes",
  waiting.log.some((line) => line.startsWith("gh pr merge 394 --auto")),
  true,
)
same(
  "land says why it waits",
  waiting.said.includes(`bar        Needs a countersign for pull request 394 at ${head}.`),
  true,
)
same(
  "and prints the brief that starts a verifier with the pull request number only",
  waiting.said.some((line) => line.startsWith("next") && line.includes("node scripts/countersign.mjs 394")),
  true,
)
same(
  "it does not follow to merged",
  waiting.said.some((line) => line.startsWith("sweep ")),
  false,
)

const countersigned = harness()
countersigned.context.countersign = () => ({ pass: true, line: `Countersigned ${head}: the deck moved.` })
same("a countersigned pull request lands and follows to merged", await countersigned.run(), 0)
same(
  "and land says it is countersigned",
  countersigned.said.includes(`bar        Countersigned ${head}: the deck moved.`),
  true,
)
same("and names the sweep at the end", countersigned.said.at(-1).includes("pnpm sweep"), true)

console.log("land countersign tests passed")
