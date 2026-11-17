import * as z from "zod/v4"
import { fieldRefusal, readNoFields } from "./wire.js"

export const resetCents = 500

const resetRequest = z.strictObject({ once: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/) })
const autoResetRequest = z.strictObject({ enabled: z.boolean() })
const credits = z.strictObject({
  cents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  autoReset: z.boolean(),
  history: z.array(
    z.strictObject({
      id: z.string(),
      at: z.iso.datetime(),
      cents: z.literal(-resetCents),
      kind: z.literal("reset"),
    }),
  ),
})

export type Credits = z.infer<typeof credits>

export function readCredits(raw: unknown): Credits | undefined {
  const parsed = credits.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

export function readCreditReset(raw: unknown) {
  const parsed = resetRequest.safeParse(raw)
  return parsed.success ? { ok: true as const, ...parsed.data } : fieldRefusal
}

export function readAutoReset(raw: unknown) {
  const parsed = autoResetRequest.safeParse(raw)
  return parsed.success ? { ok: true as const, ...parsed.data } : fieldRefusal
}

export const creditsRoutes = {
  read: { path: "/aira/credits", method: "POST", read: readNoFields },
  reset: { path: "/aira/credits/reset", method: "POST", read: readCreditReset },
  autoReset: { path: "/aira/credits/auto-reset", method: "POST", read: readAutoReset },
} as const
