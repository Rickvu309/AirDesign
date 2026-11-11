import { execFileSync } from "node:child_process"

const helper = ".agents/skills/verify-airdesign/bin/verify-airdesign.mjs"

export default function launch(): () => void {
  const launched = JSON.parse(
    execFileSync(process.execPath, [helper, "launch", "--no-build"], { encoding: "utf8" }),
  ) as {
    run: string
    origin: string
    evidence: string
  }
  process.env.VERIFY_AIRDESIGN_RUN = launched.run
  process.env.VERIFY_AIRDESIGN_ORIGIN = launched.origin
  process.stdout.write(`journeys run ${launched.run}, evidence ${launched.evidence}\n`)
  return () => {
    execFileSync(process.execPath, [helper, "stop", launched.run], { stdio: "ignore" })
  }
}
