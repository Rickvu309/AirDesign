export type StatusKind = "ok" | "money" | "error" | "limit" | "expired" | "mail"

export function StatusTile({ kind }: { kind: StatusKind }) {
  return <span className={`ad-status-tile ad-status-${kind}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{kind === "ok" ? <path d="m5 12 4 4L19 6"/> : kind === "money" ? <path d="M12 2v20M17 6H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H6"/> : kind === "mail" ? <path d="M3 5h18v14H3zM3 6l9 7 9-7"/> : kind === "expired" ? <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></> : kind === "limit" ? <circle cx="12" cy="12" r="8"/> : <path d="M12 5v9m0 4v.1"/>}</svg></span>
}
