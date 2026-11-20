import path from "node:path"
import { BaseSequencer } from "vitest/node"
import { longestFirst } from "./longest-first.mjs"
import { weightedShares } from "./spec-seconds.mjs"
import { readUnitSeconds } from "./unit-test-files.mjs"

export default class LongestFirst extends BaseSequencer {
  async shard(files) {
    const { root, shard } = this.ctx.config
    const bySpecFile = new Map(files.map((spec) => [path.relative(root, spec.moduleId), spec]))
    const { shares } = weightedShares({
      keys: [...bySpecFile.keys()],
      seconds: readUnitSeconds(root),
      total: shard.count,
    })
    return shares[shard.index - 1].map((key) => bySpecFile.get(key))
  }

  async sort(files) {
    const sorted = await super.sort(files)
    return longestFirst(sorted, (spec) => this.ctx.cache.getTestSpecificationResult(spec)?.duration)
  }
}
