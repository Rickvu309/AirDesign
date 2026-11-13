import type { SchemeName } from "@airdesign/document"

export const formatSwatches = [
  { scheme: "dk1", css: "#000000" },
  { scheme: "lt1", css: "#FFFFFF" },
  { scheme: "dk2", css: "#0F2433" },
  { scheme: "lt2", css: "#E8EEF2" },
  { scheme: "accent1", css: "#1D6B8F" },
  { scheme: "accent2", css: "#C0504D" },
  { scheme: "accent3", css: "#9BBB59" },
  { scheme: "accent4", css: "#8064A2" },
  { scheme: "accent5", css: "#4BACC6" },
  { scheme: "accent6", css: "#F79646" },
] as const satisfies readonly { readonly scheme: SchemeName; readonly css: string }[]
