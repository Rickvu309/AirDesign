import { readFile } from "node:fs/promises"
import { setTimeout } from "node:timers/promises"
import { z } from "zod"

const startedPids = z.array(z.number().int().positive()).length(2)

export async function waitForStartedPids(file: string, signal: AbortSignal): Promise<number[]> {
  for (;;) {
    signal.throwIfAborted()
    const value = await readFile(file, "utf8").catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return ""
      throw error
    })
    if (value.endsWith("\n")) return value.trim().split("\n").flatMap(line => startedPids.parse(JSON.parse(line)))
    await setTimeout(10, undefined, { signal })
  }
}
