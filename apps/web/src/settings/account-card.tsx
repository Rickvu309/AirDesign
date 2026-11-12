import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { accountCopy } from "@/copy/account-copy"
import { ModuleRow } from "@/settings/module-row"
import { settingsCopy } from "@/settings/settings-sample"

const settingsAction =
  "h-[var(--space-32)] border-0 bg-background px-3.5 text-[length:var(--type-dense)] leading-[17px] shadow-[inset_0_0_0_1px_var(--field-edge)] hover:bg-background"

export function AccountCard({
  email,
  onSignOut,
  onDelete,
}: {
  email: string
  onSignOut?: () => void
  onDelete?: () => void
}) {
  return (
    <Card title={settingsCopy.account}>
      <div className="flex flex-col gap-3.5">
        <ModuleRow
          title={settingsCopy.signedIn}
          status={email}
          action={
            <Button
              type="button"
              variant="outline"
              className={settingsAction}
              style={{ width: 79.84 }}
              onClick={onSignOut}
            >
              {settingsCopy.signOut}
            </Button>
          }
        />
        <ModuleRow
          title={settingsCopy.deleteAccount}
          status={accountCopy.deleteRowBody}
          action={
            <Button
              type="button"
              variant="outline"
              className={`${settingsAction} text-danger-text`}
              style={{ width: 122.75 }}
              onClick={onDelete}
            >
              {settingsCopy.deleteAccount}
            </Button>
          }
        />
      </div>
    </Card>
  )
}
