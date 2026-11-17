import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { creditsCopy, creditAmount, creditDate } from "@/copy/credits-copy"
import { productCopy } from "@/copy/product-copy"
import type { useCredits } from "@/credits/use-credits"

type CreditsState = ReturnType<typeof useCredits>

export function CreditsCards({ state }: { state: CreditsState }) {
  const credits = state.loaded?.kind === "credits" ? state.loaded.credits : null
  return (
    <>
      <Card
        title={creditsCopy.title}
        detail={credits === null ? undefined : creditAmount(credits.cents)}
        description={creditsCopy.facts}
        align="end"
        actions={
          <Button disabled aria-describedby="credits-purchases">
            {creditsCopy.add}
          </Button>
        }
      >
        <p id="credits-purchases" className="mb-3.5 text-[length:var(--type-dense)] text-muted-foreground">
          {creditsCopy.purchases}
        </p>
        {credits === null ? (
          state.loaded === null ? (
            <p role="status">{creditsCopy.loading}</p>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p role="alert">{creditsCopy.failed}</p>
              <Button variant="outline" onClick={() => void state.refresh()}>
                {productCopy.payTryAgain}
              </Button>
            </div>
          )
        ) : (
          <div className="flex items-center justify-between gap-4 border-t border-line pt-3.5">
            <div className="min-w-0">
              <label htmlFor="credits-auto-reset" className="text-[length:var(--type-body)] font-medium">
                {creditsCopy.autoReset}
              </label>
              <p id="credits-auto-description" className="mt-0.5 text-[length:var(--type-dense)] text-muted-foreground">
                {creditsCopy.autoResetBody}
              </p>
            </div>
            <Switch
              id="credits-auto-reset"
              checked={credits.autoReset}
              disabled={state.busy}
              aria-describedby="credits-auto-description"
              onCheckedChange={(enabled) => void state.change({ kind: "autoReset", enabled })}
            />
          </div>
        )}
        {state.error && state.reset === null ? (
          <p role="alert" className="mt-3 text-[length:var(--type-dense)] text-destructive">
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
      <Dialog
        open={state.reset !== null}
        onOpenChange={(open) => {
          if (!open) state.closeReset()
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogTitle>{creditsCopy.confirmTitle}</DialogTitle>
          <DialogDescription>{creditsCopy.confirmBody}</DialogDescription>
          {state.error ? (
            <p role="alert" className="text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={state.busy} onClick={state.closeReset}>
              {productCopy.cancel}
            </Button>
            <Button
              disabled={state.busy}
              onClick={() => {
                if (state.reset !== null) void state.change({ kind: "reset", once: state.reset })
              }}
            >
              {creditsCopy.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
