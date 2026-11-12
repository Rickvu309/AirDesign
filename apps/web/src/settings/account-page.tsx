import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { accountCopy } from "@/copy/account-copy"
import { productCopy } from "@/copy/product-copy"
import { DeleteAccountDialog } from "@/decks/delete-account"
import { loadAccount, type AccountLoad } from "@/settings/account-load"
import { AccountCard } from "@/settings/account-card"
import { SettingsPage, signOut } from "@/settings/settings-page"
import { settingsCopy } from "@/settings/settings-sample"
import { signInAddress } from "@/thin-notice"

export function AccountPage({
  navigate,
  load = loadAccount,
}: {
  navigate: (path: string) => void
  load?: () => Promise<AccountLoad>
}) {
  const [loaded, setLoaded] = useState<AccountLoad | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function refresh() {
    const next = await load()
    if (next.kind === "signed-out") window.location.assign(signInAddress(window.location))
    else setLoaded(next)
  }

  useEffect(() => {
    void Promise.resolve().then(refresh)
  }, [])

  const email = loaded?.kind === "account" ? loaded.email : ""

  return (
    <SettingsPage
      tab="account"
      email={email}
      navigate={navigate}
      onSignOut={() => void signOut()}
      overlay={deleting ? <DeleteAccountDialog email={email} onCancel={() => setDeleting(false)} /> : undefined}
    >
      {loaded?.kind === "unavailable" ? (
        <Card title={settingsCopy.account}>
          <div role="alert" className="flex items-center justify-between gap-4">
            <span className="text-[length:var(--type-body)] leading-[18px] text-muted-foreground">
              {accountCopy.failed}
            </span>
            <Button type="button" variant="outline" onClick={() => void refresh()}>
              {productCopy.payTryAgain}
            </Button>
          </div>
        </Card>
      ) : (
        <AccountCard email={email} onSignOut={() => void signOut()} onDelete={() => setDeleting(email !== "")} />
      )}
    </SettingsPage>
  )
}
