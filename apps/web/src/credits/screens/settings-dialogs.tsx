import { AddCreditsDialog } from "@/credits/add-credits-dialog"
import { addedBalance, addedHistory, amountEntry, creditsCopy } from "@/credits/credits-sample"
import { ErrorTile, ExpiredTile, MoneyTile, OkTile, ResultDialog } from "@/credits/result-dialog"
import { UsageStage, WaitingBanner } from "@/credits/usage-stage"
import { productCopy } from "@/copy/product-copy"
import { UsageTab } from "@/settings/screens/usage-tab"
import { usageHistory } from "@/settings/settings-sample"

export function AddCreditsAmount() {
  return (
    <UsageTab>
      <AddCreditsDialog open {...amountEntry} />
    </UsageTab>
  )
}

export function WaitingForPayment() {
  return <UsageStage balance={amountEntry.balance} history={usageHistory} banner={<WaitingBanner />} />
}

export function CreditsAdded() {
  return (
    <UsageStage balance={addedBalance} history={addedHistory}>
      <ResultDialog icon={<OkTile />} title={creditsCopy.addedTitle} body={creditsCopy.addedBody} primary={productCopy.done} />
    </UsageStage>
  )
}

export function PaymentFailed() {
  return (
    <UsageTab>
      <ResultDialog
        icon={<ErrorTile />}
        title={productCopy.payFailedTitle}
        body={productCopy.payNotCharged}
        secondary={productCopy.close}
        primary={productCopy.payTryAgain}
      />
    </UsageTab>
  )
}

export function PaymentExpired() {
  return (
    <UsageTab>
      <ResultDialog
        icon={<ExpiredTile />}
        title={productCopy.payExpiredTitle}
        body={productCopy.payNotCharged}
        secondary={productCopy.close}
        primary={productCopy.payTryAgain}
      />
    </UsageTab>
  )
}

export function ConfirmResetDialog() {
  return (
    <ResultDialog
      icon={<MoneyTile />}
      title={productCopy.usageResetConfirmTitle}
      body={productCopy.usageResetConfirmBody}
      secondary={productCopy.cancel}
      primary={productCopy.usageResetAction}
    />
  )
}
