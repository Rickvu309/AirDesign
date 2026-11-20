import fs from "node:fs"
import path from "node:path"
import { shardOf } from "../../scripts/check-steps.mjs"
import { weightedShares } from "../../scripts/spec-seconds.mjs"

export const journeyFolder = ".agents/skills/verify-airdesign/journeys/"
export const journeyNameOf = (file) => /^([a-z0-9-]+)\.mjs$/.exec(file)?.[1]
export const journeySecondsName = "journey-seconds.json"

export const journeyGrep = ({ root, changed, shard }) => {
  if (!changed && !shard) return undefined
  const available = fs.readdirSync(path.join(root, journeyFolder)).map(journeyNameOf).filter(Boolean)
  const selected = changed ? JSON.parse(changed) : available
  if (!Array.isArray(selected) || selected.length === 0 || selected.some((name) => !available.includes(name)))
    throw new Error("JOURNEYS_CHANGED must name existing journeys.")
  const { current, total } = shardOf([`--shard=${shard || "1/1"}`])
  const seconds = JSON.parse(fs.readFileSync(path.join(root, "tests/journeys", journeySecondsName), "utf8"))
  const share = weightedShares({ keys: selected, seconds, total }).shares[current - 1]
  if (share.length === 0) throw new Error(`Journey shard ${current}/${total} is empty. Use fewer shards.`)
  return new RegExp(` (?:${share.join("|")})$`)
}
