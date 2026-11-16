import { ApproveClaude } from "@/connect/screens/approve-claude"
import { ApproveCodex } from "@/connect/screens/approve-codex"
import { ClaudeConnected } from "@/connect/screens/claude-connected"

import { ConnectRefused, ConnectUnavailable } from "@/connect/screens/connect-errors"

export const screens = {
  "/screens/s71-04-agents-connect-unavailable": ConnectUnavailable,
  "/screens/s71-05-agents-connect-refused": ConnectRefused,
  "/screens/s71-01-agents-connect-approve-claude": ApproveClaude,
  "/screens/s71-02-agents-connect-claude-connected": ClaudeConnected,
  "/screens/s71-03-agents-connect-approve-codex": ApproveCodex,
}
