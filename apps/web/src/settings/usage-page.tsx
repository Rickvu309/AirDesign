import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { settingsAction } from "@/settings/settings-action"
import { cn } from "@/lib/class-names"
import { productCopy, usageResetsOn } from "@/copy/product-copy"
import { usageCopy, usageUsedOf } from "@/copy/usage-copy"
import { resetsWhen, usagePercent } from "@/aira/aira-usage"
import { SettingsPage } from "@/settings/settings-page"
import { signOut } from "@/account/sign-out"
import { signInAddress } from "@/account/sign-in-address"
import { loadUsage, type UsageLoad } from "@/aira/usage-load"

import { useCredits } from "@/credits/use-credits"
import { CreditsCards } from "@/credits/credits-cards"
import { creditsCopy } from "@/copy/credits-copy"
import { resetCents } from "@airdesign/catalog"

import { PageToaster } from "@/components/ui/page-notice"

export function UsagePage({
  navigate,
  load = loadUsage,
}: {
  navigate: (path: string) => void
  load?: () => Promise<UsageLoad>
}) {
  const [loaded, setLoaded] = useState<UsageLoad | null>(null)

  async function refresh() {
    const next = await load()
    if (next.kind === "signed-out") window.location.assign(signInAddress(window.location))
    else setLoaded(next)
  }

  const credits = useCredits(refresh)

  useEffect(() => {
    void Promise.resolve().then(refresh)
    const focused = () => void refresh()
    window.addEventListener("focus", focused)
    return () => window.removeEventListener("focus", focused)
  }, [])

  const week = loaded?.kind === "usage" ? loaded.usage : null
  const percent = week === null ? 0 : usagePercent(week)
  return (
    <SettingsPage
      overlay={<PageToaster />}
      tab="usage"
      email={loaded?.kind === "usage" ? loaded.email : ""}
      navigate={navigate}
      onSignOut={() => void signOut()}
    >
      <Card
        actions={
          <Button
            type="button"
            variant="secondary"
            className="border-input bg-accent px-3.5 font-semibold hover:bg-input disabled:text-muted-foreground disabled:opacity-100"
            disabled={
              credits.busy ||
              week === null ||
              week.used === 0 ||
              credits.loaded?.kind !== "credits" ||
              credits.loaded.credits.cents < resetCents
            }
            onClick={credits.openReset}
          >
            {creditsCopy.reset}
          </Button>
        }
        title={productCopy.usageTitle}
        {...(week === null ? {} : { description: usageResetsOn(resetsWhen(week.resets)) })}
      >
        {loaded?.kind === "unavailable" ? (
          <div role="alert" className="flex items-center justify-between gap-4">
            <span className="text-[length:var(--type-body)] leading-[18px] text-muted-foreground">
              {usageCopy.failed}
            </span>
            <Button type="button" variant="outline" className={settingsAction} onClick={() => void refresh()}>
              {productCopy.payTryAgain}
            </Button>
          </div>
        ) : (
          <div className="flex h-[var(--space-16)] items-center gap-3" data-usage-week>
            <div
              role="meter"
              aria-label={productCopy.usageTitle}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-busy={week === null ? "true" : undefined}
              data-loading={week === null ? "true" : undefined}
              className={cn("h-2 min-w-0 flex-1 rounded-sm bg-line", week === null && "motion-safe:animate-pulse")}
            >
              <div
                data-usage-fill
                className={cn("h-2 rounded-sm", percent >= 100 ? "bg-destructive" : "bg-primary")}
                style={{ width: `${String(percent)}%` }}
              />
            </div>
            <span
              className={cn(
                "text-[length:var(--type-dense)] leading-[17px] text-muted-foreground",
                week === null && "motion-safe:animate-pulse",
              )}
            >
              {week === null ? usageCopy.loading : usageUsedOf(percent)}
            </span>
          </div>
        )}
      </Card>
      <CreditsCards state={credits} />
    </SettingsPage>
  )
}
