import { expect } from "vitest"

export type Sent = { readonly path: string; readonly body: Record<string, unknown> }

export function answeringServer() {
  const sent: Sent[] = []
  return {
    sent,
    fetch: async (path: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      sent.push({ path, body })
      return new Response(JSON.stringify({ ok: true, ...body }))
    },
    async drained(queue: () => Promise<readonly unknown[]>): Promise<readonly Sent[]> {
      await expect.poll(queue).toEqual([])
      return sent
    },
  }
}
