import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { ConfirmationDialog } from "@/components/ui/dialog"
import { creditsCopy, creditAmount, creditDate } from "@/copy/credits-copy"
import { productCopy } from "@/copy/product-copy"
import { cn } from "@/lib/class-names"
import type { useCredits } from "@/credits/use-credits"

import { showStatus } from "@/components/ui/page-notice"

type CreditsState = ReturnType<typeof useCredits>

export function CreditsCards({ state }: { state: CreditsState }) {
  const loading = state.loaded === null
  const credits = state.loaded?.kind === "credits" ? state.loaded.credits : null
  return (
    <>
      <Card
        title={creditsCopy.title}
        detail={
          credits !== null ? creditAmount(credits.cents) : loading ? <span aria-hidden="true">&nbsp;</span> : undefined
        }
        description={creditsCopy.facts}
        align="end"
        actions={
          <Button variant="signature" onClick={() => showStatus(creditsCopy.purchases, "credits-purchases", 5000)}>
            {creditsCopy.add}
          </Button>
        }
      >
        {credits === null && !loading ? (
          <div className="flex items-center justify-between gap-4">
            <p role="alert">{creditsCopy.failed}</p>
            <Button variant="outline" onClick={() => void state.refresh()}>
              {productCopy.payTryAgain}
            </Button>
          </div>
        ) : (
          <div className="grid border-t border-line pt-3.5">
            <div
              aria-hidden={loading || undefined}
              className={cn("col-start-1 row-start-1 flex items-center justify-between gap-4", loading && "invisible")}
            >
              <div className="min-w-0">
                <label htmlFor="credits-auto-reset" className="text-[length:var(--type-body)] font-medium">
                  {creditsCopy.autoReset}
                </label>
                <p
                  id="credits-auto-description"
                  className="mt-0.5 text-[length:var(--type-dense)] text-muted-foreground"
                >
                  {creditsCopy.autoResetBody}
                </p>
              </div>
              {credits === null ? (
                <span className="w-[var(--space-32)] shrink-0" />
              ) : (
                <Switch
                  id="credits-auto-reset"
                  checked={credits.autoReset}
                  disabled={state.busy}
                  aria-describedby="credits-auto-description"
                  onCheckedChange={(enabled) => void state.change({ kind: "autoReset", enabled })}
                />
              )}
            </div>
            {loading && (
              <p
                role="status"
                className="col-start-1 row-start-1 self-center text-[length:var(--type-dense)] text-muted-foreground"
              >
                {creditsCopy.loading}
              </p>
            )}
          </div>
        )}
        {state.error && state.reset === null ? (
          <p role="alert" className="mt-3 text-[length:var(--type-dense)] text-danger-text">
            {state.error}
          </p>
        ) : null}
      </Card>
      <Card title={creditsCopy.history}>
        {credits === null ? (
          <p className="text-[length:var(--type-dense)] text-muted-foreground">
            {state.loaded === null ? creditsCopy.loading : creditsCopy.failed}
          </p>
        ) : credits.history.length === 0 ? (
          <p className="text-[length:var(--type-dense)] text-muted-foreground">{creditsCopy.emptyHistory}</p>
        ) : (
          <>
            <ul>
              {credits.history.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-4 border-b border-line py-2.5 text-[length:var(--type-dense)] max-sm:flex-wrap"
                >
                  <time dateTime={row.at} className="shrink-0 text-muted-foreground">
                    {creditDate(row.at)}
                  </time>
                  <span className="min-w-0 flex-1">{creditsCopy.resetEntry}</span>
                  <span className="shrink-0 text-right font-medium">{creditAmount(row.cents)}</span>
                </li>
              ))}
            </ul>
            {credits.history.length >= 100 ? (
              <p className="mt-3 text-[length:var(--type-caption)] text-muted-foreground">{creditsCopy.historyLimit}</p>
            ) : null}
          </>
        )}
      </Card>
      {state.reset !== null && (
        <ConfirmationDialog
          title={creditsCopy.confirmTitle}
          body={creditsCopy.confirmBody}
          action={creditsCopy.confirm}
          busy={state.busy}
          onCancel={state.closeReset}
          onConfirm={() => {
            if (state.reset !== null) void state.change({ kind: "reset", once: state.reset })
          }}
        >
          {state.error ? (
            <p
              role="alert"
              className="mt-3 text-[length:var(--type-dense)] leading-[var(--leading-body)] text-danger-text"
            >
              {state.error}
            </p>
          ) : null}
        </ConfirmationDialog>
      )}
    </>
  )
}
