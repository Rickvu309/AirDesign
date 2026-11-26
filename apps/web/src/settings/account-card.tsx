import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/class-names"
import { settingsAction } from "@/settings/settings-action"
import { accountCopy } from "@/copy/account-copy"
import { ModuleRow } from "@/settings/module-row"
import { settingsCopy } from "@/copy/settings-copy"

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
              className={cn(settingsAction, "text-danger-text hover:text-danger-text")}
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
