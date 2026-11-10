export type Remote = {
  open(body: {
    readonly deck: string
  }): Promise<
    | { ok: true; readonly deck: string; readonly revision: number; readonly register: unknown }
    | { ok: false; readonly refusal: string }
  >
  commit(body: {
    readonly deck: string
    readonly batch: readonly { readonly value: string; readonly node?: "a" | "b" }[]
  }): Promise<
    | { ok: true; readonly deck: string; readonly revision: number; readonly key: string }
    | { ok: false; readonly refusal: string }
  >
  watch(body: {
    readonly deck: string
    readonly cursor: number | null
  }): Promise<{ ok: true; readonly deck: string; readonly revision: number } | { ok: false; readonly refusal: string }>
}

export type ConfirmedRow = {
  readonly kind: "confirmed"
  readonly deck: string
  readonly revision: number
  readonly value: string
  readonly node?: "a" | "b"
}

export type PendingRow = {
  readonly kind: "pending"
  readonly deck: string
  readonly order: number
  readonly base: number
  readonly value: string
  readonly node?: "a" | "b"
}

export type StoredRow = ConfirmedRow | PendingRow

export function memoryRemote(): Remote
export function httpRemote(): Remote
export function rowKey(deck: string, kind: "confirmed" | "pending", number: number): string
export function putPart(bytes: Uint8Array): Promise<string>
export function getPart(hash: string): Promise<Uint8Array>
export function deleteDatabase(): Promise<void>
export const databaseName: string
export const storeName: string

export type Cache = {
  enqueue(
    deck: string,
    value: string,
    node?: "a" | "b",
  ): Promise<{ ok: true; readonly painted: string } | { ok: false; readonly refusal: string }>
  flush(
    deck: string,
  ): Promise<
    | { ok: true; readonly deck: string; readonly revision: number; readonly key: string }
    | { ok: false; readonly refusal: string }
  >
  openDeck(deck: string): Promise<
    | {
        ok: true
        readonly register: { readonly landed: readonly { readonly value: string }[] }
        readonly phase: "on-device" | "confirmed"
        readonly pending: readonly PendingRow[]
        readonly confirmed: readonly ConfirmedRow[]
      }
    | { ok: false; readonly refusal: string }
  >
  phase(deck: string): Promise<"on-device" | "confirmed">
  pending(deck: string): Promise<readonly PendingRow[]>
  rows(deck: string): Promise<readonly StoredRow[]>
  watch(
    deck: string,
    cursor: number | null,
  ): Promise<{ ok: true; readonly deck: string; readonly revision: number } | { ok: false; readonly refusal: string }>
}

export function connect(remote: Remote): Cache
