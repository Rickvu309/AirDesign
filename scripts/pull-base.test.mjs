import { baseFault } from "./pull-base.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

same("a pull request against main is fine", baseFault(406, "main"), undefined)
same(
  "pull request 403 was opened against another pull request's branch and is refused with the fix",
  baseFault(403, "agent-element-tools"),
  "pull request 403 targets agent-element-tools, and every pull request targets main. A branch of another pull request has no required ci and no recheck, so a merge there lands untested, and a later force-push of that branch drops it. Fix: run pnpm land in its branch; it moves the base to main.",
)
