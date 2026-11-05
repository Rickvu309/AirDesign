declare const runIdBrand: unique symbol
declare const personIdBrand: unique symbol

export type RunId = string & { readonly [runIdBrand]: "RunId" }
export type PersonId = string & { readonly [personIdBrand]: "PersonId" }

const runIdPattern = /^run_[a-z0-9-]+$/
const personIdPattern = /^person_[a-z0-9-]+$/

export function asRunId(value: string): RunId {
  if (!runIdPattern.test(value)) {
    throw new Error("invalid-run-id")
  }
  return value as RunId
}

export function asPersonId(value: string): PersonId {
  if (!personIdPattern.test(value)) {
    throw new Error("invalid-person-id")
  }
  return value as PersonId
}

export function assertNever(value: never): never {
  throw new Error(`unhandled:${JSON.stringify(value)}`)
}
