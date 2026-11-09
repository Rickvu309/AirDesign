import { ApproveAgent } from "@/connect/approve-agent"
import { codexConnect } from "@/connect/connect-copy"

export function ApproveCodex() {
  return (
    <ApproveAgent
      agent="codex"
      title={codexConnect.title}
      subtitle={codexConnect.subtitle}
      ability={codexConnect.ability}
      footer={codexConnect.footer}
      screenTitle={codexConnect.approveTitle}
    />
  )
}
