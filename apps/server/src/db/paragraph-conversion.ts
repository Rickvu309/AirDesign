import {Worker} from "node:worker_threads"
import type {LegacyHistoryArchiveV2, ParagraphHistoryArchiveV3} from "../../../../packages/change-log/src/text/history-transducer.ts"

type ConversionMessage = {kind: "started"} | {kind: "converted"; archives: ParagraphHistoryArchiveV3[]; conversionMs: number}
export async function convertParagraphArchives(archives: LegacyHistoryArchiveV2[], budgetMs: number, signal?: AbortSignal) {
  if (!Number.isSafeInteger(budgetMs) || budgetMs < 1) throw new Error("invalid-conversion-budget")
  signal?.throwIfAborted()
  const worker = new Worker(new URL("./paragraph-conversion-worker.ts", import.meta.url), {workerData: archives})
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort = () => {}
  try {
    return await new Promise<{archives: ParagraphHistoryArchiveV3[]; conversionMs: number}>((resolve, reject) => {
      abort = () => reject(new Error("paragraph-conversion-interrupted"))
      signal?.addEventListener("abort", abort, {once: true})
      worker.on("error", reject)
      worker.on("exit", () => reject(new Error("paragraph-conversion-worker-exited")))
      worker.on("message", (message: ConversionMessage) => {
        if (message.kind === "started") timer = setTimeout(() => reject(new Error("paragraph-conversion-timeout")), budgetMs)
        else resolve(message)
      })
      if (signal?.aborted) abort()
    })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", abort)
    await worker.terminate()
  }
}
