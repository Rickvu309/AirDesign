import {describe, expect, it} from "vitest"
import {admitTextProtocol, initialTextAdmission} from "../../src/text/protocol.ts"

describe("paragraph cutover admission contract", () => {
  it("starts in legacy mode without conversion", () => {
    expect(admitTextProtocol(initialTextAdmission, "legacy-text-v2")).toEqual({kind: "admitted", protocol: "legacy-text-v2"})
    expect(admitTextProtocol(initialTextAdmission, "paragraph-body-v3").kind).toBe("refused")
  })
  it.each(["legacy-text-v2", "paragraph-body-v3", undefined])("truthfully refuses requests during a pause: %s", requested => {
    expect(admitTextProtocol({kind: "paused", protocol: "legacy-text-v2"}, requested)).toEqual({kind: "refused", code: "editing-paused", retryable: true, next: "retain-and-retry"})
  })
  it.each(["legacy-text-v2", undefined, "future-protocol"])("refuses old or unknown protocols after native resume: %s", requested => {
    expect(admitTextProtocol({kind: "ready", protocol: "paragraph-body-v3"}, requested)).toEqual({kind: "refused", code: "editing-protocol-mismatch", retryable: false, next: "retain-and-reconcile"})
  })
})
