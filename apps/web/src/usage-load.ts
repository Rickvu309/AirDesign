import { useCallback, useEffect, useRef, useState } from "react"
import { airaRoutes } from "@airdesign/catalog"
import { fieldsOf, weekUsage, type WeekUsage } from "@/aira-wire"

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

type Fetched = { readonly usage: WeekUsage; readonly after: WeekUsage | null; readonly available: boolean }

export function useWeekUsage(
  fromTurn: WeekUsage | null,
  load: () => Promise<UsageLoad> = loadUsage,
): { readonly usage: WeekUsage | null; readonly available: boolean; readonly refresh: () => void } {
  const [fetched, setFetched] = useState<Fetched | null>(null)
  const mounted = useRef(true)
  const turn = useRef(fromTurn)
  const keep = useCallback(
    (after: WeekUsage | null) =>
      void load().then((loaded) => {
        if (mounted.current && loaded.kind === "usage")
          setFetched({ usage: loaded.usage, after, available: loaded.available })
      }),
    [load],
  )
  useEffect(() => {
    mounted.current = true
    keep(null)
    return () => {
      mounted.current = false
    }
  }, [keep])
  useEffect(() => {
    turn.current = fromTurn
  }, [fromTurn])
  const usage = fetched !== null && fetched.after === fromTurn ? fetched.usage : (fromTurn ?? fetched?.usage ?? null)
  return { usage, available: fetched?.available ?? true, refresh: () => keep(turn.current) }
}
