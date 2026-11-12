import { useState } from "react"
import { deleteDatabase } from "@airdesign/live"
import { accountCopy } from "@/copy/account-copy"
import { Input } from "@/components/ui/input"
import { askDeletion, matchesEmail, type Deletion } from "@/decks/account-deletion"
import { DangerDialog } from "@/decks/danger-dialog"
import { settingsCopy } from "@/settings/settings-sample"
import { signInAddress } from "@/thin-notice"

async function leave(deletion: Deletion): Promise<boolean> {
  if (deletion === "refused") return false
  if (deletion === "deleted") await deleteDatabase().catch(() => undefined)
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
        void askDeletion(email)
          .then(leave)
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
        <p role="alert" className="mt-3 text-[length:var(--type-dense)] leading-[var(--leading-body)] text-destructive">
          {accountCopy.deleteFailed}
        </p>
      ) : null}
    </DangerDialog>
  )
}
