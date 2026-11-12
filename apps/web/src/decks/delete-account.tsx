import { useState } from "react"
import { accountRoutes } from "@airdesign/catalog"
import { deleteDatabase } from "@airdesign/live"
import { Input } from "@/components/ui/input"
import { DangerDialog } from "@/decks/danger-dialog"
import { settingsCopy } from "@/settings/settings-sample"
import { signInAddress } from "@/thin-notice"

async function deleteAccount(email: string): Promise<void> {
  const response = await fetch(accountRoutes.delete.path, {
    method: accountRoutes.delete.method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  })
  if (response.ok) await deleteDatabase()
  if (response.ok || response.status === 401) window.location.assign(signInAddress(window.location))
}

export function DeleteAccountDialog({ email, onCancel }: { email: string; onCancel: () => void }) {
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <DangerDialog
      title={settingsCopy.deleteAccount}
      body={settingsCopy.deleteBody}
      action={settingsCopy.deleteAccount}
      busy={busy}
      ready={typed.trim().toLowerCase() === email}
      className="pb-6"
      onCancel={onCancel}
      onConfirm={() => {
        setBusy(true)
        void deleteAccount(email)
          .catch(() => undefined)
          .finally(() => setBusy(false))
      }}
    >
      <label className="mt-4 flex flex-col gap-1.5 text-[length:var(--type-dense)] leading-[var(--leading-body)] font-medium text-foreground">
        {settingsCopy.signedIn}
        <Input
          type="email"
          autoComplete="off"
          placeholder={email}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </label>
    </DangerDialog>
  )
}
