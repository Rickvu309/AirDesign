export const timeoutMs = 30000

export type Tab =
  | { readonly presence: "absent" }
  | {
      readonly presence: "hidden" | "visible"
      readonly elapsedMs: number
      readonly version: number
      readonly authority: number
    }

type Reach = "ready" | "no-open-tab" | "tab-hidden" | "tab-timeout" | "tab-outdated"

function elapsed(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function counted(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}

export function openTab(
  fields:
    | {
        readonly presence: "absent"
        readonly elapsedMs?: number
        readonly version?: number
        readonly authority?: number
      }
    | {
        readonly presence: "hidden" | "visible"
        readonly elapsedMs: number
        readonly version: number
        readonly authority: number
      },
): Tab | null {
  if (fields.presence === "absent") {
    return { presence: "absent" }
  }
  if (!elapsed(fields.elapsedMs) || !counted(fields.version) || !counted(fields.authority)) {
    return null
  }
  return {
    presence: fields.presence,
    elapsedMs: fields.elapsedMs,
    version: fields.version,
    authority: fields.authority,
  }
}

export function reach(tab: Tab): Reach {
  if (tab.presence === "absent") {
    return "no-open-tab"
  }
  if (tab.presence === "hidden") {
    return "tab-hidden"
  }
  if (tab.elapsedMs >= timeoutMs) {
    return "tab-timeout"
  }
  if (tab.version !== tab.authority) {
    return "tab-outdated"
  }
  return "ready"
}
