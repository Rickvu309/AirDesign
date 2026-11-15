import { BaseSequencer } from "vitest/node"
import { longestFirst } from "./longest-first.mjs"

export default class LongestFirst extends BaseSequencer {
  async sort(files) {
    const sorted = await super.sort(files)
    return longestFirst(sorted, (spec) => this.ctx.cache.getTestSpecificationResult(spec)?.duration)
  }
}
