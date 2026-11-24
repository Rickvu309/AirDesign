import { readFileSync } from "node:fs"
import { availableParallelism } from "node:os"
import { performance } from "node:perf_hooks"
import { setTimeout as pause } from "node:timers/promises"
import type { TestInfo } from "@playwright/test"
import { keptWait, keptWaitApproval } from "./kept-wait"

const pollMs = 100
const waitMs = 120_000

const runnableCount = (): number => {
  const running = Number(/\s(\d+)\/\d+\s/.exec(readFileSync("/proc/loadavg", "utf8"))?.[1])
  if (!Number.isInteger(running)) throw new Error("could not read runnable tasks from /proc/loadavg")
  return running
}

type PhaseSamples = {
  readonly cores: number
  readonly waiting: readonly number[]
  readonly measuring: readonly number[]
}

export function checkPhaseSpeed(phase: string, samples: PhaseSamples, check: () => void): void {
  try {
    check()
  } catch (error) {
    const peak = Math.max(...samples.measuring)
    if (peak < samples.cores || !(error instanceof Error)) throw error
    throw new Error(
      `machine oversubscribed during ${phase}: max ${String(peak)} runnable on ${String(samples.cores)} cores; speed not measured\n${error.message}`,
      { cause: error },
    )
  }
}

export async function measureOnQuietMachine<T>(
  evidence: Map<string, unknown>,
  phase: string,
  measure: () => Promise<T>,
  testInfo: TestInfo,
): Promise<{ reading: T; checkSpeed: (check: () => void) => void }> {
  const cores = availableParallelism()
  const waiting: number[] = []
  const measuring: number[] = []
  const samples = { cores, waiting, measuring }
  evidence.set(`machine: ${phase}`, samples)
  const sample = () => {
    const runnable = runnableCount()
    waiting.push(runnable)
    return runnable
  }
  let runnable = sample()
  if (runnable >= cores) {
    const testTimeout = testInfo.timeout
    const started = performance.now()
    const allowAdmissionTime = (ms: number) => {
      if (testTimeout !== 0)
        testInfo.setTimeout(
          keptWait(testTimeout + ms, {
            why: "machine admission time sits outside the speed spec's execution timeout",
            until: "2027-02-18",
            approval: keptWaitApproval,
          }),
        )
    }
    allowAdmissionTime(waitMs)
    try {
      const deadline = AbortSignal.timeout(waitMs)
      while (runnable >= cores) {
        if (deadline.aborted)
          throw new Error(
            `machine oversubscribed: ${runnable} runnable on ${cores} cores; speed not measured (${phase})`,
          )
        await pause(pollMs)
        runnable = sample()
      }
    } finally {
      const waited = Math.ceil(performance.now() - started)
      allowAdmissionTime(waited)
      testInfo.annotations.push({ type: "metric", description: `machine admission (${phase}) waited ${waited} ms` })
    }
  }
  const sampler = setInterval(() => measuring.push(runnableCount()), pollMs)
  try {
    const reading = await measure()
    return { reading, checkSpeed: (check) => checkPhaseSpeed(phase, samples, check) }
  } finally {
    clearInterval(sampler)
  }
}
