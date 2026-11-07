import { readFileSync } from "node:fs"
import { relative } from "node:path"
import { BaseSequencer, type TestSpecification } from "vitest/node"
import { z } from "zod"

const durations = z.record(z.string(), z.number().positive()).parse(JSON.parse(readFileSync(new URL("./unit-durations.json", import.meta.url), "utf8")))

export function measuredPartitions<T>(files: readonly T[], count: number, name: (file: T) => string): T[][] {
  const groups = Array.from({ length: count }, () => ({ files: new Array<T>(), seconds: 0 }))
  const seconds = (file: T) => durations[name(file)] ?? 1
  const ordered = [...files].sort((a, b) => seconds(b) - seconds(a) || name(a).localeCompare(name(b)))
  for (const file of ordered) {
    const target = groups.reduce((smallest, group) => group.seconds < smallest.seconds ? group : smallest)
    target.files.push(file)
    target.seconds += seconds(file)
  }
  return groups.map(group => group.files)
}

export class MeasuredSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shard = this.ctx.config.shard
    if (!shard) throw new Error("Unit sharding requires an index and count")
    return measuredPartitions(files, shard.count, file => relative(this.ctx.config.root, file.moduleId).replaceAll("\\", "/"))[shard.index - 1] ?? []
  }
}
