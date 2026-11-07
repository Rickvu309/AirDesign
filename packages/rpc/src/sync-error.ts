export type SyncErrorCode = "sync-unavailable" | "deck-deleted" | "deck-not-found" | "request-id-payload-mismatch" | "invalid-command" | "invalid-sequence" | "invalid-run-credential" | "account-deleted" | "account-deleting"
export function syncErrorCode(error:unknown):SyncErrorCode {
  const code=error instanceof Error ? error.message : error
  switch(code){
    case "deck-deleted":
    case "deck-not-found":
    case "request-id-payload-mismatch":
    case "invalid-sequence":
    case "invalid-run-credential":
    case "account-deleted":
    case "account-deleting":
    case "invalid-command": return code
    default: return "sync-unavailable"
  }
}
