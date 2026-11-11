const allowance = 2_000_000_000
const searchFee = 10_000_000

const listPrice = {
  input: 2_000,
  output: 10_000,
  write5m: 2_500,
  write1h: 4_000,
  read: 100,
} as const

export type Ledger = {
  readonly spent: number
  readonly hold: number
  readonly turn: string | null
  readonly week: number
  readonly outside: number
}

export type Command =
  | {
      readonly command: "reserve"
      readonly id: string
      readonly input: number
      readonly maxTokens: number
      readonly coldPrefix: number
      readonly search: number
      readonly searchOn: boolean
      readonly usOnly: boolean
    }
  | {
      readonly command: "settle"
      readonly id: string
      readonly input: number
      readonly output: number
      readonly write5m: number
      readonly write1h: number
      readonly read: number
      readonly search: number
      readonly searchOn: boolean
      readonly usOnly: boolean
    }
  | { readonly command: "release"; readonly id: string }
  | { readonly command: "monday" }
  | { readonly command: "outside" }

type UsageResult = {
  readonly ledger: Ledger
  readonly accepted: boolean
}

export function openLedger(): Ledger {
  return { spent: 0, hold: 0, turn: null, week: 0, outside: 0 }
}

function inference(tokens: number, usOnly: boolean): number {
  if (!usOnly) return tokens
  return Number((BigInt(tokens) * 11n) / 10n)
}

function searchCharge(search: number, searchOn: boolean): number {
  if (!searchOn) return 0
  return search * searchFee
}

function reserveCeiling(command: Extract<Command, { command: "reserve" }>): number {
  const tokens =
    command.input * listPrice.input + command.maxTokens * listPrice.output + command.coldPrefix * listPrice.write1h
  return inference(tokens, command.usOnly) + searchCharge(command.search, command.searchOn)
}

function settleCharge(command: Extract<Command, { command: "settle" }>): number {
  const tokens =
    command.input * listPrice.input +
    command.output * listPrice.output +
    command.write5m * listPrice.write5m +
    command.write1h * listPrice.write1h +
    command.read * listPrice.read
  return inference(tokens, command.usOnly) + searchCharge(command.search, command.searchOn)
}

function refused(ledger: Ledger): UsageResult {
  return { ledger, accepted: false }
}

function accepted(ledger: Ledger): UsageResult {
  return { ledger, accepted: true }
}

export function usage(ledger: Ledger, command: Command): UsageResult {
  if (command.command === "reserve") {
    if (ledger.turn !== null) return refused(ledger)
    const ceiling = reserveCeiling(command)
    if (ceiling === 0 || ledger.spent + ceiling > allowance) return refused(ledger)
    return accepted({ ...ledger, turn: command.id, hold: ceiling })
  }
  if (command.command === "settle") {
    if (ledger.turn !== command.id) return refused(ledger)
    return accepted({ ...ledger, spent: ledger.spent + settleCharge(command), hold: 0, turn: null })
  }
  if (command.command === "release") {
    if (ledger.turn !== command.id) return refused(ledger)
    return accepted({ ...ledger, hold: 0, turn: null })
  }
  if (command.command === "monday") {
    if (ledger.turn !== null) return refused(ledger)
    return accepted({ ...ledger, spent: 0, week: ledger.week + 1 })
  }
  return accepted({ ...ledger, outside: ledger.outside + 1 })
}
