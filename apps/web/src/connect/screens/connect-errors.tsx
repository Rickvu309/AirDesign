import { ConnectError } from "@/connect/connect-error"

export function ConnectUnavailable() {
  return <ConnectError kind="unavailable" />
}

export function ConnectRefused() {
  return <ConnectError kind="refused" />
}
