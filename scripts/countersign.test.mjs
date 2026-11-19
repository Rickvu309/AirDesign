import { barSigned, countersignBody, countersignFor, postFault, verifierSteps } from "./countersign.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const head = "a".repeat(40)
const older = "b".repeat(40)
const reason = "The paint-fidelity job moved to its own workflow, which still runs on every main commit."
const owner = (body) => ({ body, association: "OWNER" })
const signed = countersignBody({ head, verdict: "right", reason })

same(
  "a countersign is the agent line, then one line with the head, the verdict and the reason",
  signed,
  `🤖 **AI Agent responding on behalf of Quan Vu**\n\ncountersign ${head} right: ${reason}\n`,
)
same("a countersign for the head is read back", countersignFor([owner(signed)], head), { verdict: "right", reason })
same(
  "a countersign for an older head is stale",
  countersignFor([owner(countersignBody({ head: older, verdict: "right", reason }))], head),
  undefined,
)
same(
  "a stranger's countersign on the public repository counts for nothing",
  countersignFor([{ body: signed, association: "NONE" }], head),
  undefined,
)
same(
  "the latest countersign for the head wins",
  countersignFor(
    [owner(signed), owner(countersignBody({ head, verdict: "wrong", reason: "It drops a judged deck." }))],
    head,
  ),
  { verdict: "wrong", reason: "It drops a judged deck." },
)
same(
  "a comment that only names the word is no countersign",
  countersignFor([owner("countersign later")], head),
  undefined,
)

same("a pull request that lowers nothing needs no countersign", barSigned({ lowers: false, head }), { pass: true })
same("a lowered bar with no countersign fails and names the head", barSigned({ lowers: true, head }), {
  pass: false,
  line: `Needs a countersign: this pull request lowers the bar, and no agent that did not write it has countersigned ${head}. pnpm land prints how to start one.`,
})
same(
  "a countersign that says right lets it pass",
  barSigned({ lowers: true, head, countersign: { verdict: "right", reason } }),
  {
    pass: true,
    line: `Countersigned ${head}: ${reason}`,
  },
)
same(
  "a countersign that says wrong keeps it failing",
  barSigned({ lowers: true, head, countersign: { verdict: "wrong", reason: "It drops a judged deck." } }),
  { pass: false, line: `Countersign refused for ${head}: It drops a judged deck.` },
)

same(
  "a verdict for the current head with one line of reason posts",
  postFault({ head, current: head, verdict: "right", reason }),
  undefined,
)
same(
  "a verdict for a head that moved is refused",
  postFault({ head: older, current: head, verdict: "right", reason }),
  `the head of the pull request is ${head}, not ${older}. Judge the new head.`,
)
same(
  "only right or wrong is a verdict",
  postFault({ head, current: head, verdict: "fine", reason }),
  "the verdict is right or wrong.",
)
same(
  "the reason is one line",
  postFault({ head, current: head, verdict: "right", reason: "a\nb" }),
  "the reason is one line of text.",
)
same(
  "the reason is not empty",
  postFault({ head, current: head, verdict: "right", reason: " " }),
  "the reason is one line of text.",
)

const steps = verifierSteps(776)
same(
  "the next step names both ways to start a verifier",
  ["delegate_task", "fresh agent"].every((word) => steps[0].includes(word)),
  true,
)
same("the verifier gets the pull request number only", steps[1].includes("node scripts/countersign.mjs 776"), true)
same(
  "the verifier never reads the author's argument",
  steps[1].includes("Do not read the pull request's body or comments"),
  true,
)
same(
  "the steps give the comment form",
  steps.some((line) => line.includes("countersign <head> right: <reason>")),
  true,
)

console.log("countersign tests passed")
