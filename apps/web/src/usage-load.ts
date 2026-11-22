import { useCallback, useEffect, useRef, useState } from "react"
import { airaRoutes } from "@airdesign/catalog"
import { fieldsOf, weekUsage, type WeekUsage } from "@/aira/aira-wire"

export type UsageLoad =
  | { readonly kind: "usage"; readonly email: string; readonly usage: WeekUsage; readonly available: boolean }
  | { readonly kind: "signed-out" }
  | { readonly kind: "unavailable" }

const unavailable: UsageLoad = { kind: "unavailable" }

export async function loadUsage(send: typeof fetch = fetch): Promise<UsageLoad> {
  try {
    const response = await send(airaRoutes.usage.path, {
      method: airaRoutes.usage.method,
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    const body = fieldsOf(await response.json().catch(() => undefined))
    if (response.status === 401 && body?.refusal === "session") return { kind: "signed-out" }
    const usage = weekUsage(body?.usage)
    const email = fieldsOf(body?.account)?.email
    if (response.status !== 200 || usage === undefined || typeof email !== "string") return unavailable
    return { kind: "usage", email, usage, available: body?.available !== false }
  } catch {
    return unavailable
  }
}

type Fetched = { readonly loaded: UsageLoad; readonly after: WeekUsage | null }

export function useWeekUsage(
  fromTurn: WeekUsage | null,
  online: boolean,
  load: () => Promise<UsageLoad> = loadUsage,
): {
  readonly usage: WeekUsage | null
  readonly available: boolean
  readonly loaded: UsageLoad | undefined
  readonly refresh: () => Promise<UsageLoad>
} {
  const [fetched, setFetched] = useState<Fetched | null>(null)
  const mounted = useRef(true)
  const turn = useRef(fromTurn)
  const request = useRef(0)
  const keep = useCallback(
    async (after: WeekUsage | null) => {
      const current = ++request.current
      const loaded = await load()
      if (mounted.current && request.current === current) setFetched({ loaded, after })
      return loaded
    },
    [load],
  )
  useEffect(() => {
    mounted.current = true
    if (online) void keep(turn.current)
    return () => {
      mounted.current = false
    }
  }, [keep, online])
  useEffect(() => {
    turn.current = fromTurn
  }, [fromTurn])
  const loaded = fetched?.loaded
  const reading = loaded?.kind === "usage" ? loaded.usage : null
  const usage = fetched?.after === fromTurn ? (reading ?? fromTurn) : (fromTurn ?? reading)
  return {
    usage,
    available: loaded?.kind === "usage" ? loaded.available : true,
    loaded,
    refresh: () => keep(turn.current),
  }
}
