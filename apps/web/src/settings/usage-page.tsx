import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/class-names"
import { productCopy, usageResetsOn } from "@/copy/product-copy"
import { usageCopy, usageUsedOf } from "@/copy/usage-copy"
import { resetsWhen, usagePercent } from "@/aira-usage"
import { SettingsPage, signOut } from "@/settings/settings-page"
import { signInAddress } from "@/thin-notice"
import { loadUsage, type UsageLoad } from "@/usage-load"

const settingsAction =
  "h-[var(--space-32)] border-0 bg-background px-3.5 text-[length:var(--type-dense)] leading-[17px] shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-background"

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
      tab="usage"
      email={loaded?.kind === "usage" ? loaded.email : ""}
      navigate={navigate}
      onSignOut={() => void signOut()}
    >
      <Card
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
              className="h-2 min-w-0 flex-1 rounded-sm bg-line"
            >
              <div
                data-usage-fill
                className={cn("h-2 rounded-sm", percent >= 100 ? "bg-destructive" : "bg-primary")}
                style={{ width: `${String(percent)}%` }}
              />
            </div>
            <span className="text-[length:var(--type-dense)] leading-[17px] text-muted-foreground">
              {week === null ? null : usageUsedOf(percent)}
            </span>
          </div>
        )}
      </Card>
      <Card title={usageCopy.runsOutTitle} description={usageCopy.runsOutBody} />
    </SettingsPage>
  )
}
