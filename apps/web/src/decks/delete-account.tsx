import { useState } from "react"
import { accountKey, dropAccount } from "@airdesign/live"
import { accountCopy } from "@/copy/account-copy"
import { Input } from "@/components/ui/input"
import { askDeletion, matchesEmail, type Deletion } from "@/decks/account-deletion"
import { DangerDialog } from "@/decks/danger-dialog"
import { settingsCopy } from "@/copy/settings-copy"
import { signInAddress } from "@/thin-notice"

async function leave(deletion: Deletion, account: string | undefined): Promise<boolean> {
  if (deletion === "refused") return false
  if (deletion === "deleted") await dropAccount(account).catch(() => undefined)
  window.location.assign(signInAddress(window.location))
  return true
}

export function DeleteAccountDialog({ email, onCancel }: { email: string; onCancel: () => void }) {
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <DangerDialog
      title={accountCopy.deleteTitle}
      body={accountCopy.deleteBody}
      action={settingsCopy.deleteAccount}
      busy={busy}
      ready={matchesEmail(typed, email)}
      className="pb-6"
      onCancel={onCancel}
      onConfirm={() => {
        setBusy(true)
        setFailed(false)
        const account = accountKey()
        void askDeletion(email)
          .then((deletion) => leave(deletion, account))
          .catch(() => false)
          .then((left) => setFailed(!left))
          .finally(() => setBusy(false))
      }}
    >
      <label className="mt-4 flex flex-col gap-1.5 text-[length:var(--type-dense)] leading-[var(--leading-body)] font-medium text-foreground">
        {accountCopy.deleteConfirmLabel}
        <Input
          type="email"
          autoComplete="off"
          placeholder={email}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </label>
      {failed ? (
        <p role="alert" className="mt-3 text-[length:var(--type-dense)] leading-[var(--leading-body)] text-danger-text">
          {accountCopy.deleteFailed}
        </p>
      ) : null}
    </DangerDialog>
  )
}
