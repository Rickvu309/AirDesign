import type * as doom from "@airdesign/doom"

export type Sent = { readonly node: doom.NodeId; readonly draft: doom.Text; readonly onces: readonly string[] }

export function refusedText(
  notices: readonly { readonly once: string }[],
  sent: Sent | null,
): { readonly node: doom.NodeId; readonly draft: doom.Text; readonly only: boolean } | null {
  if (sent === null) return null
  const mine = notices.filter((notice) => sent.onces.includes(notice.once))
  if (mine.length === 0) return null
  return { node: sent.node, draft: sent.draft, only: mine.length === notices.length }
}
