export type TextProtocol = "legacy-text-v2" | "paragraph-body-v3"
export type TextAdmission = {kind: "ready"; protocol: TextProtocol} | {kind: "paused"; protocol: TextProtocol}
export type TextAdmissionRefusal =
  {kind: "refused"; code: "editing-feature-pending"; retryable: false; next: "retain-and-reconcile"} |
  {kind: "refused"; code: "editing-paused"; retryable: true; next: "retain-and-retry"} |
  {kind: "refused"; code: "editing-protocol-mismatch"; retryable: false; next: "retain-and-reconcile"}
export type TextAdmissionResult = {kind: "admitted"; protocol: TextProtocol} | TextAdmissionRefusal
export const initialTextAdmission: TextAdmission = {kind: "ready", protocol: "legacy-text-v2"}
export function admitTextProtocol(state: TextAdmission, requested: unknown): TextAdmissionResult {
  if (state.kind === "paused") return {kind: "refused", code: "editing-paused", retryable: true, next: "retain-and-retry"}
  if (requested !== state.protocol) return {kind: "refused", code: "editing-protocol-mismatch", retryable: false, next: "retain-and-reconcile"}
  return {kind: "admitted", protocol: state.protocol}
}
