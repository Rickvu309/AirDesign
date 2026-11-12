import { connect } from "@airdesign/live"
import { indexPackage } from "@airdesign/pptx"
import { server } from "@/commit-edit"

export async function backfillIndex(deck: string, parts: ReadonlyMap<string, Uint8Array>): Promise<void> {
  const queued = await connect(server).index(deck, indexPackage(parts))
  if (!queued.ok) throw new Error(queued.refusal)
}
